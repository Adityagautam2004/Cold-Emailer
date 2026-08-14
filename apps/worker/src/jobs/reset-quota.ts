import { nextLocalMidnight } from "@dispatch/core";
import { logger } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { Queue, Worker, type ConnectionOptions } from "bullmq";

const JOB_ID = "reset-quota";
const INTERVAL_MS = 15 * 60 * 1000;
const QUEUE_NAME = "reset-quota";

/**
 * §9.3 — every 15 minutes, any account whose local midnight has passed gets its counter
 * zeroed and its next reset time recomputed from ITS OWN timezone, not UTC. Each row needs
 * its own `nextLocalMidnight` call (different users, different timezones), so this is a
 * read-then-per-row-update rather than one blanket UPDATE.
 */
export async function resetDueQuotas(): Promise<number> {
  // EmailAccount has no timezone of its own — the owning user's timezone applies.
  const due = await prisma.emailAccount.findMany({
    where: { quotaResetAt: { lte: new Date() } },
    include: { user: { select: { timezone: true } } },
  });
  if (due.length === 0) return 0;

  const now = new Date();
  await Promise.all(
    due.map((a) =>
      prisma.emailAccount.update({
        where: { id: a.id },
        data: { sentToday: 0, quotaResetAt: nextLocalMidnight(a.user.timezone, now) },
      })
    )
  );

  return due.length;
}

export async function registerResetQuotaJob(connection: ConnectionOptions): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(QUEUE_NAME, { connection });

  await queue.upsertJobScheduler(
    JOB_ID,
    { every: INTERVAL_MS },
    { name: JOB_ID, opts: { removeOnComplete: true, removeOnFail: 20 } }
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const count = await resetDueQuotas();
      if (count > 0) logger.info({ count }, "reset quota for accounts past local midnight");
    },
    // See tick.ts for why drainDelay (seconds) is raised — this job only fires every 15
    // minutes, so idle-polling every 5s wastes Redis commands for no benefit.
    { connection, drainDelay: 55 }
  );
  worker.on("error", (err) => logger.error({ err }, "reset-quota worker error"));

  return { queue, worker };
}
