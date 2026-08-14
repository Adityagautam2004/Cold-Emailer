import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pollDueInboxes, processInboxMessage } from "./poll-inbox.js";

const stamp = Date.now();
let userId: string;
let accountId: string;
let listId: string;
let campaignId: string;
let stepId: string;

type Account = { id: string; userId: string; fromEmail: string; credentialEnc: string; imapHost: string; lastImapUid: number | null };
let account: Account;

async function makeContact(email: string) {
  return prisma.contact.create({ data: { listId, email, rowNumber: 1 } });
}

async function makeSentSend(contactId: string, overrides: Partial<{ providerMessageId: string; sentAt: Date; status: string }> = {}) {
  return prisma.send.create({
    data: {
      campaignId,
      contactId,
      stepId,
      scheduledAt: overrides.sentAt ?? new Date(),
      sentAt: overrides.sentAt ?? new Date(),
      status: overrides.status ?? "sent",
      providerMessageId: overrides.providerMessageId,
    },
  });
}

function rawMessage(headers: Record<string, string>, body: string): Buffer {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  return Buffer.from(`${headerLines}\r\n\r\n${body}\r\n`, "utf8");
}

function dsnMessage(fromAddress: string, ownAddress: string, failedRecipient: string): Buffer {
  const boundary = "BOUNDARY123";
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Delivery to the following recipient failed permanently:",
    "",
    `     ${failedRecipient}`,
    "",
    `--${boundary}`,
    "Content-Type: message/delivery-status",
    "",
    "Reporting-MTA: dns; mx.google.com",
    `Final-Recipient: rfc822; ${failedRecipient}`,
    "Action: failed",
    "Status: 5.1.1",
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return rawMessage(
    {
      From: fromAddress,
      To: ownAddress,
      Subject: "Delivery Status Notification (Failure)",
      "Content-Type": `multipart/report; report-type=delivery-status; boundary="${boundary}"`,
    },
    body
  );
}

describe("poll-inbox: processInboxMessage (§13)", () => {
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `poll-test-${stamp}-${randomUUID()}@example.com` } });
    userId = user.id;

    const emailAccount = await prisma.emailAccount.create({
      data: {
        userId,
        fromEmail: `poll-${randomUUID()}@gmail.com`,
        fromName: "Poll Test",
        credentialEnc: "v1.fake.fake.fake",
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "active",
      },
    });
    accountId = emailAccount.id;
    account = {
      id: emailAccount.id,
      userId,
      fromEmail: emailAccount.fromEmail,
      credentialEnc: emailAccount.credentialEnc,
      imapHost: emailAccount.imapHost,
      lastImapUid: null,
    };

    const resume = await prisma.resume.create({ data: { userId, storageKey: `${userId}/r.pdf`, filename: "r.pdf", sizeBytes: 10 } });
    const list = await prisma.contactList.create({ data: { userId, name: "Poll fixture", sourceFilename: "x.csv" } });
    listId = list.id;
    const template = await prisma.template.create({ data: { userId, name: "T", subject: "Hi {{company}}", bodyText: "Hi {{hr_name}}" } });
    const campaign = await prisma.campaign.create({
      data: { userId, listId, resumeId: resume.id, emailAccountId: accountId, name: "Poll fixture campaign", status: "running" },
    });
    campaignId = campaign.id;
    const step = await prisma.campaignStep.create({ data: { campaignId, templateId: template.id, stepOrder: 0 } });
    stepId = step.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: `poll-test-${stamp}` } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.campaign.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("matches a reply via In-Reply-To against Send.providerMessageId and cancels pending follow-ups", async () => {
    const contact = await makeContact(`hr-msgid-${stamp}@acmecorp.com`);
    const messageId = `<${randomUUID()}.abc@dispatch.app>`;
    await makeSentSend(contact.id, { providerMessageId: messageId });

    // A pending follow-up for the same contact, from a second campaign step.
    const followUpStep = await prisma.campaignStep.create({
      data: { campaignId, templateId: (await prisma.campaignStep.findUniqueOrThrow({ where: { id: stepId } })).templateId, stepOrder: 1, delayDays: 3 },
    });
    const pendingFollowUp = await prisma.send.create({
      data: { campaignId, contactId: contact.id, stepId: followUpStep.id, scheduledAt: new Date(Date.now() + 60_000), status: "queued" },
    });

    const raw = rawMessage(
      {
        From: contact.email,
        To: account.fromEmail,
        Subject: "Re: Hi Acme Corp",
        "In-Reply-To": messageId,
        References: messageId,
        "Content-Type": "text/plain; charset=utf-8",
      },
      "Thanks, let's schedule a call."
    );

    await processInboxMessage(account, raw);

    const after = await prisma.contact.findUnique({ where: { id: contact.id } });
    expect(after?.status).toBe("replied");

    const followUpAfter = await prisma.send.findUnique({ where: { id: pendingFollowUp.id } });
    expect(followUpAfter?.status).toBe("cancelled");

    const suppression = await prisma.suppression.findUnique({ where: { userId_email: { userId, email: contact.email } } });
    expect(suppression?.reason).toBe("replied");

    const event = await prisma.event.findFirst({ where: { userId, type: "replied" } });
    expect(event).not.toBeNull();
  });

  it("falls back to matching the From address against a recently-sent contact when no Message-ID matches", async () => {
    const contact = await makeContact(`hr-fallback-${stamp}@acmecorp.com`);
    await makeSentSend(contact.id, { providerMessageId: `<${randomUUID()}@dispatch.app>`, sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });

    const raw = rawMessage(
      {
        From: contact.email,
        To: account.fromEmail,
        Subject: "Following up",
        "Content-Type": "text/plain; charset=utf-8",
      },
      "Sure, happy to chat."
    );

    await processInboxMessage(account, raw);

    const after = await prisma.contact.findUnique({ where: { id: contact.id } });
    expect(after?.status).toBe("replied");
  });

  it("does not match a From address with no recent send history (avoids false positives)", async () => {
    const raw = rawMessage(
      { From: `stranger-${stamp}@example.com`, To: account.fromEmail, Subject: "Hi", "Content-Type": "text/plain" },
      "Random unrelated email."
    );

    await processInboxMessage(account, raw);

    const suppressions = await prisma.suppression.findMany({ where: { userId } });
    expect(suppressions).toHaveLength(0);
  });

  it("detects a DSN bounce, marks the contact bounced, and suppresses the address", async () => {
    const contact = await makeContact(`bounced-${stamp}@acmecorp.com`);
    await makeSentSend(contact.id, { providerMessageId: `<${randomUUID()}@dispatch.app>` });

    const raw = dsnMessage("mailer-daemon@googlemail.com", account.fromEmail, contact.email);
    await processInboxMessage(account, raw);

    const after = await prisma.contact.findUnique({ where: { id: contact.id } });
    expect(after?.status).toBe("bounced");

    const suppression = await prisma.suppression.findUnique({ where: { userId_email: { userId, email: contact.email } } });
    expect(suppression?.reason).toBe("bounced");

    const event = await prisma.event.findFirst({ where: { userId, type: "bounced" } });
    expect(event).not.toBeNull();
  });

  it("marks the account errored (and pauses its running campaigns) if the stored credential can't be decrypted, instead of retrying forever", async () => {
    await prisma.emailAccount.update({ where: { id: accountId }, data: { credentialEnc: "v1.not-real-ciphertext.at.all" } });

    // pollDueInboxes() is intentionally global (the real scheduler polls every due account),
    // so only assert against this test's own account/campaign rather than the full return count.
    await pollDueInboxes();

    const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
    expect(account?.status).toBe("error");
    expect(account?.statusReason).toMatch(/decrypted/i);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(campaign?.status).toBe("paused");
  });

  it("recognises a bounce via multipart/report content-type even from a non-standard sender address", async () => {
    const contact = await makeContact(`bounced2-${stamp}@acmecorp.com`);
    await makeSentSend(contact.id, { providerMessageId: `<${randomUUID()}@dispatch.app>` });

    // Some providers relay DSNs from an address that isn't literally mailer-daemon@/postmaster@.
    const raw = dsnMessage(`bounce-relay@some-mta.example.com`, account.fromEmail, contact.email);
    await processInboxMessage(account, raw);

    const after = await prisma.contact.findUnique({ where: { id: contact.id } });
    expect(after?.status).toBe("bounced");
  });
});
