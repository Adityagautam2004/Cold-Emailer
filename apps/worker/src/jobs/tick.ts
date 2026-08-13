import { logger } from "@dispatch/config";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES } from "../queues.js";

const TICK_JOB_ID = "tick";
const TICK_INTERVAL_MS = 60_000;

export async function registerTickJob(connection: ConnectionOptions): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(QUEUE_NAMES.scheduler, { connection });

  await queue.upsertJobScheduler(
    TICK_JOB_ID,
    { every: TICK_INTERVAL_MS },
    { name: TICK_JOB_ID, opts: { removeOnComplete: true, removeOnFail: 100 } }
  );

  const worker = new Worker(
    QUEUE_NAMES.scheduler,
    async () => {
      // §10.2's SKIP LOCKED claim query and per-send re-checks land here in Phase 5.
      logger.debug("tick");
    },
    { connection }
  );

  worker.on("error", (err) => logger.error({ err }, "scheduler worker error"));

  return { queue, worker };
}
