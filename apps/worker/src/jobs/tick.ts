import { effectiveDailyCap, isWithinSendWindow, nextEligibleWindowStart } from "@dispatch/core";
import { logger } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES } from "../queues.js";
import { resetDueQuotas } from "./reset-quota.js";
import { pollDueInboxes } from "./poll-inbox.js";

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
      if (claimed.length > 0) {
        const haltedAccounts = new Set<string>();
        for (const row of claimed) {
          await processClaimedSend(row.id, haltedAccounts, sendQueue);
        }
        logger.debug({ claimed: claimed.length }, "tick processed");
      } else {
        logger.debug("tick: 0 due");
      }

      // Reset-quota and inbox-poll used to be their own BullMQ queues, each with a repeatable
      // scheduler. Both underlying checks are already self-gated by a DB "is this actually
      // due" query (nextLocalMidnight / lastPolledAt cutoff), so calling them every tick is
      // just two cheap SQL queries — negligible next to the Redis cost of a whole extra
      // queue. BullMQ hardcodes a 10s floor on the idle blocking-wait for any queue with a
      // repeatable job scheduled (see taskforcesh/bullmq#1658) — that floor can't be tuned via
      // options, so it was a fixed per-queue tax. Folding both into this tick removed two of
      // those queues entirely instead of just trying to poll them less often.
      const resetCount = await resetDueQuotas();
      if (resetCount > 0) logger.info({ count: resetCount }, "reset quota for accounts past local midnight");

      const polledCount = await pollDueInboxes();
      if (polledCount > 0) logger.debug({ count: polledCount }, "poll-inbox: polled due accounts");
    },
    // drainDelay is in SECONDS — how long to long-poll Redis before re-checking an empty
    // queue. Default (5s) means idle workers hammer Upstash with a Redis command roughly
    // every 5s forever, which burns through a pay-per-command plan fast. The scheduler only
    // enqueues a tick once every TICK_INTERVAL_MS anyway, so there is nothing to gain from
    // polling faster than that — a real job push still wakes the blocking call immediately.
    // stalledInterval (ms, default 30000) runs a separate "is any active job stalled" check
    // on its own timer regardless of drainDelay — 5 minutes is still fast recovery for a
    // single-process worker at this send volume, and cuts that check's Redis cost ~10x.
    { connection, drainDelay: 55, stalledInterval: 5 * 60_000 }
  );

  worker.on("error", (err) => logger.error({ err }, "scheduler worker error"));

  return { queue, worker };
}
