import { effectiveDailyCap, isWithinSendWindow, nextEligibleWindowStart } from "@dispatch/core";
import { logger } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES } from "../queues.js";

const TICK_JOB_ID = "tick";
const TICK_INTERVAL_MS = 60_000;
const CLAIM_BATCH_SIZE = 100;
const CLAIMED_STUCK_MINUTES = 10;
// computeSlots deliberately clamps a day's last slot to exactly windowEnd whenever jitter would
// overshoot (roughly half the time, by construction). A byte-exact `now() within window` recheck
// would then reject that send the instant any real processing delay pushes `now()` past windowEnd
// by even a few ms — bouncing it to the next eligible day. Tolerate a few minutes of processing lag
// measured from the send's own scheduledAt before treating it as genuinely late/stale.
const WINDOW_RECHECK_GRACE_MS = 5 * 60_000;

interface ClaimedRow {
  id: string;
  campaignId: string;
}

/**
 * §10.2's claim query. FOR UPDATE ... SKIP LOCKED inside a single WITH/UPDATE/RETURNING
 * statement is one atomic round-trip to Postgres — safe with more than one worker process,
 * and safe if a tick overruns 60 seconds, because a row already being claimed by another
 * tick is simply skipped, not blocked on.
 */
export async function claimDueSends(): Promise<ClaimedRow[]> {
  return prisma.$queryRaw<ClaimedRow[]>`
    WITH due AS (
      SELECT s.id
        FROM "sends" s
        JOIN "campaigns" c ON c.id = s."campaignId"
        JOIN "email_accounts" a ON a.id = c."emailAccountId"
       WHERE s.status = 'queued'
         AND s."scheduledAt" <= now()
         AND c.status = 'running'
         AND a.status = 'active'
       ORDER BY s."scheduledAt"
       FOR UPDATE OF s SKIP LOCKED
       LIMIT ${CLAIM_BATCH_SIZE}
    )
    UPDATE "sends" SET status = 'claimed', "claimedAt" = now()
     WHERE id IN (SELECT id FROM due)
    RETURNING id, "campaignId";
  `;
}

async function requeue(sendId: string, scheduledAt: Date, reason: string) {
  await prisma.send.update({
    where: { id: sendId },
    data: { status: "queued", scheduledAt, claimedAt: null },
  });
  logger.debug({ sendId, scheduledAt, reason }, "requeued");
}

/** Reclaims sends stuck in `claimed` for more than 10 minutes — crash recovery if a worker died mid-send (§10.2). */
export async function sweepStuckClaims(): Promise<void> {
  const cutoff = new Date(Date.now() - CLAIMED_STUCK_MINUTES * 60_000);
  const result = await prisma.send.updateMany({
    where: { status: "claimed", claimedAt: { lte: cutoff } },
    data: { status: "queued", claimedAt: null },
  });
  if (result.count > 0) {
    logger.warn({ count: result.count }, "swept stuck claimed sends back to queued");
  }
}

export async function processClaimedSend(sendId: string, haltedAccounts: Set<string>, sendQueue: Queue): Promise<void> {
  const send = await prisma.send.findUnique({
    where: { id: sendId },
    include: { campaign: { include: { emailAccount: true } }, contact: true },
  });
  if (!send) return;

  const { campaign, contact } = send;
  const windowInput = {
    windowStart: campaign.windowStart,
    windowEnd: campaign.windowEnd,
    daysOfWeek: campaign.daysOfWeek,
    timezone: campaign.timezone,
  };

  // 1. Re-check window/day — a send scheduled for 17:59 that we pick up at 18:04 must be
  // pushed to tomorrow, not sent late. A short grace period (measured from the send's own
  // scheduledAt, not from windowEnd) absorbs normal claim/process latency around a slot that
  // landed exactly on windowEnd, without letting a genuinely stale/backlogged send through.
  if (!isWithinSendWindow(new Date(), windowInput)) {
    const lateMs = Date.now() - send.scheduledAt.getTime();
    if (lateMs > WINDOW_RECHECK_GRACE_MS) {
      await requeue(sendId, nextEligibleWindowStart(new Date(), windowInput), "outside send window");
      return;
    }
  }

  // 2. Re-check suppression — the contact may have replied to a different campaign since
  // this send was scheduled.
  const suppressed = await prisma.suppression.findUnique({
    where: { userId_email: { userId: campaign.userId, email: contact.email } },
  });
  if (suppressed) {
    await prisma.send.update({ where: { id: sendId }, data: { status: "skipped", lastError: "on suppression list" } });
    return;
  }

  // 3. Consume quota atomically (§9.2) — never read-then-write.
  if (haltedAccounts.has(campaign.emailAccountId)) {
    await requeue(sendId, nextEligibleWindowStart(new Date(), windowInput), "account halted earlier this tick");
    return;
  }

  const account = campaign.emailAccount;
  const cap = effectiveDailyCap({ warmupStartedAt: account.warmupStartedAt, campaignPerDayCap: campaign.perDayCap });
  const consumed = await prisma.$executeRaw`
    UPDATE "email_accounts" SET "sentToday" = "sentToday" + 1
     WHERE id = ${account.id} AND "sentToday" < ${cap} AND status = 'active'
  `;
  if (consumed === 0) {
    haltedAccounts.add(campaign.emailAccountId);
    await requeue(sendId, nextEligibleWindowStart(new Date(), windowInput), "quota exhausted or account halted");
    return;
  }

  // 4. Hand off to the send queue — the actual SMTP call happens there.
  await sendQueue.add("send", { sendId }, { removeOnComplete: true, removeOnFail: 500 });
}

export async function registerTickJob(
  connection: ConnectionOptions,
  sendQueue: Queue
): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(QUEUE_NAMES.scheduler, { connection });

  await queue.upsertJobScheduler(
    TICK_JOB_ID,
    { every: TICK_INTERVAL_MS },
    { name: TICK_JOB_ID, opts: { removeOnComplete: true, removeOnFail: 100 } }
  );

  const worker = new Worker(
    QUEUE_NAMES.scheduler,
    async () => {
      await sweepStuckClaims();

      const claimed = await claimDueSends();
      if (claimed.length === 0) {
        logger.debug("tick: 0 due");
        return;
      }

      const haltedAccounts = new Set<string>();
      for (const row of claimed) {
        await processClaimedSend(row.id, haltedAccounts, sendQueue);
      }
      logger.debug({ claimed: claimed.length }, "tick processed");
    },
    { connection }
  );

  worker.on("error", (err) => logger.error({ err }, "scheduler worker error"));

  return { queue, worker };
}
