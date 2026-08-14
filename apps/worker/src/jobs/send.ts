import {
  appendOptOut,
  buildListUnsubscribeHeaders,
  computeSlots,
  renderTemplate,
  resolveFollowUpThreading,
  resumeAttachmentFilename,
} from "@dispatch/core";
import { decrypt } from "@dispatch/core/src/crypto.js";
import { generateMessageId } from "@dispatch/core/src/message-id.js";
import { classifySendError, nextRetryDelayMs } from "@dispatch/core/src/sender/errors.js";
import { createSender } from "@dispatch/core/src/sender/index.js";
import { buildUnsubscribeUrl } from "@dispatch/core/src/unsubscribe.js";
import { env, logger } from "@dispatch/config";
import { Prisma, prisma } from "@dispatch/db";
import { Worker, type ConnectionOptions } from "bullmq";
import { checkCircuitBreaker } from "../circuit-breaker.js";
import { pauseAccountOnError } from "../account-errors.js";
import { getResumeBuffer } from "../resume-cache.js";
import { QUEUE_NAMES } from "../queues.js";

const APP_HOST = new URL(env.APP_URL).hostname;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function scheduleFollowUpIfDue(campaign: {
  id: string;
  windowStart: string;
  windowEnd: string;
  daysOfWeek: number[];
  timezone: string;
}, contactId: string, currentStepOrder: number) {
  const nextStep = await prisma.campaignStep.findUnique({
    where: { campaignId_stepOrder: { campaignId: campaign.id, stepOrder: currentStepOrder + 1 } },
  });
  if (!nextStep) return;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.status !== "sent") return; // replied/bounced/unsubscribed since — don't chase

  const target = new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000);
  // Reuse computeSlots for a single slot — it already implements "snap into the window,
  // same day if still eligible and early enough, otherwise the next eligible day" (§10.3).
  const [scheduledAt] = computeSlots({
    count: 1,
    startFrom: target,
    perDayCap: 1,
    minGapMinutes: 1,
    windowStart: campaign.windowStart,
    windowEnd: campaign.windowEnd,
    daysOfWeek: campaign.daysOfWeek,
    timezone: campaign.timezone,
  });

  try {
    await prisma.send.create({
      data: { campaignId: campaign.id, contactId, stepId: nextStep.id, scheduledAt, status: "queued" },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

export async function processSend(sendId: string): Promise<void> {
  const send = await prisma.send.findUnique({
    where: { id: sendId },
    include: {
      campaign: { include: { emailAccount: true, resume: true, user: true } },
      contact: true,
      step: { include: { template: true } },
    },
  });
  if (!send || send.status !== "claimed") return; // reclaimed, cancelled, or already handled

  const { campaign, contact, step } = send;
  const { emailAccount, resume, user } = campaign;

  const renderCtx = {
    hrName: contact.hrName,
    company: contact.company,
    title: contact.title,
    myName: user.name ?? "",
    myCollege: user.college,
    custom: contact.custom as Record<string, string | number | null | undefined>,
  };
  const subjectResult = renderTemplate(step.template.subject, renderCtx);
  const bodyResult = renderTemplate(step.template.bodyText, renderCtx);
  if (!subjectResult.ok || !bodyResult.ok) {
    // Shouldn't happen — the campaign builder validates every contact against every step's
    // template before a campaign can start. Fail loudly rather than send something broken.
    await prisma.send.update({
      where: { id: send.id },
      data: { status: "failed", lastError: "template failed to render at send time" },
    });
    return;
  }

  let finalSubject = subjectResult.text!;
  let inReplyTo: string | undefined;
  let references: string[] | undefined;

  if (step.stepOrder > 0) {
    const anchorSelect = { renderedSubject: true, providerMessageId: true } as const;
    const [rootSend, priorSend] = await Promise.all([
      prisma.send.findFirst({ where: { campaignId: campaign.id, contactId: contact.id, step: { stepOrder: 0 } }, select: anchorSelect }),
      step.stepOrder === 1
        ? Promise.resolve(null)
        : prisma.send.findFirst({
            where: { campaignId: campaign.id, contactId: contact.id, step: { stepOrder: step.stepOrder - 1 } },
            select: anchorSelect,
          }),
    ]);
    // Step 1's own immediately-preceding step IS the root — no second row to fetch.
    const threading = resolveFollowUpThreading(rootSend, priorSend ?? rootSend);
    if (threading.subject) finalSubject = threading.subject;
    inReplyTo = threading.inReplyTo;
    references = threading.references;
  }

  const unsubscribeUrl = buildUnsubscribeUrl(env.APP_URL, { userId: user.id, email: contact.email }, env.UNSUBSCRIBE_SECRET);
  const textWithOptOut = appendOptOut(bodyResult.text!, unsubscribeUrl);
  const messageId = generateMessageId(send.id, APP_HOST);
  const headers = buildListUnsubscribeHeaders(unsubscribeUrl);

  let attachment: { filename: string; content: Buffer; contentType: string } | undefined;
  if (campaign.attachResume) {
    const buffer = await getResumeBuffer(resume.id, resume.storageKey, resume.updatedAt);
    attachment = { filename: resumeAttachmentFilename(user.name ?? "Student"), content: buffer, contentType: "application/pdf" };
  }

  if (env.SEND_DRY_RUN) {
    logger.info({ sendId: send.id, to: contact.email }, "SEND_DRY_RUN — not calling SMTP");
    await prisma.$transaction([
      prisma.send.update({
        where: { id: send.id },
        data: { status: "sent", sentAt: new Date(), providerMessageId: messageId, renderedSubject: finalSubject, threadId: send.id },
      }),
      prisma.contact.update({ where: { id: contact.id }, data: { status: "sent" } }),
      prisma.event.create({ data: { sendId: send.id, userId: user.id, type: "sent", meta: { dryRun: true } } }),
    ]);
    await scheduleFollowUpIfDue(campaign, contact.id, step.stepOrder);
    return;
  }

  let secret: string;
  try {
    secret = decrypt(emailAccount.credentialEnc);
  } catch (err) {
    // Same reasoning as poll-inbox.ts: an undecryptable credential will never succeed on
    // retry, so treat it as an account-class error immediately rather than letting the
    // stuck-claim sweeper hand this Send back for an identical failure every 10 minutes.
    logger.error({ sendId: send.id, err }, "send: stored credential could not be decrypted");
    await prisma.send.update({ where: { id: send.id }, data: { status: "failed", lastError: "Stored credential could not be decrypted." } });
    await pauseAccountOnError(emailAccount.id, user.id, "Stored credential could not be decrypted. Reconnect your mailbox.");
    return;
  }

  const sender = createSender({
    provider: "smtp",
    fromEmail: emailAccount.fromEmail,
    fromName: emailAccount.fromName,
    smtpHost: emailAccount.smtpHost,
    smtpPort: emailAccount.smtpPort,
    secret,
  });

  try {
    await sender.send({
      to: contact.email,
      toName: contact.hrName ?? undefined,
      subject: finalSubject,
      text: textWithOptOut,
      messageId,
      attachment,
      headers,
      inReplyTo,
      references,
    });

    await prisma.$transaction([
      prisma.send.update({
        where: { id: send.id },
        data: { status: "sent", sentAt: new Date(), providerMessageId: messageId, renderedSubject: finalSubject, threadId: send.id },
      }),
      prisma.contact.update({ where: { id: contact.id }, data: { status: "sent" } }),
      prisma.event.create({ data: { sendId: send.id, userId: user.id, type: "sent", meta: {} } }),
    ]);

    await scheduleFollowUpIfDue(campaign, contact.id, step.stepOrder);
  } catch (err) {
    const classified = classifySendError(err);
    logger.warn({ sendId: send.id, class: classified.class, reason: classified.reason }, "send failed");

    if (classified.class === "permanent") {
      await prisma.$transaction([
        prisma.send.update({ where: { id: send.id }, data: { status: "failed", lastError: classified.reason } }),
        prisma.contact.update({ where: { id: contact.id }, data: { status: "bounced" } }),
        prisma.suppression.upsert({
          where: { userId_email: { userId: user.id, email: contact.email } },
          create: { userId: user.id, email: contact.email, reason: "bounced" },
          update: {},
        }),
        prisma.event.create({ data: { sendId: send.id, userId: user.id, type: "bounced", meta: { reason: classified.reason } } }),
      ]);
      await checkCircuitBreaker(campaign.id);
    } else if (classified.class === "account") {
      // The attempt did hit Gmail (it authenticated the connection) — quota consumption stands.
      await prisma.send.update({ where: { id: send.id }, data: { status: "failed", lastError: classified.reason } });
      await pauseAccountOnError(emailAccount.id, user.id, classified.reason);
    } else {
      // transient — the SMTP call never actually completed, give the quota back (§9.2).
      await prisma.emailAccount.update({ where: { id: emailAccount.id }, data: { sentToday: { decrement: 1 } } });
      const delay = nextRetryDelayMs(send.attempts);
      if (delay === null) {
        await prisma.send.update({
          where: { id: send.id },
          data: { status: "failed", lastError: classified.reason, attempts: send.attempts + 1 },
        });
      } else {
        await prisma.send.update({
          where: { id: send.id },
          data: {
            status: "queued",
            scheduledAt: new Date(Date.now() + delay),
            attempts: send.attempts + 1,
            lastError: classified.reason,
            claimedAt: null,
          },
        });
      }
    }
  } finally {
    await sender.close();
  }
}

export function registerSendWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker(
    QUEUE_NAMES.send,
    async (job) => {
      await processSend(job.data.sendId as string);
    },
    { connection, concurrency: 5 }
  );
  worker.on("error", (err) => logger.error({ err }, "send worker error"));
  worker.on("failed", (job, err) => logger.error({ sendId: job?.data?.sendId, err }, "send job failed"));
  return worker;
}
