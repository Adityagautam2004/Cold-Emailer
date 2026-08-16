import { env, logger } from "@dispatch/config";
import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.js";
import { QUEUE_NAMES } from "./queues.js";
import { registerTickJob } from "./jobs/tick.js";
import { registerSendWorker } from "./jobs/send.js";

async function main() {
  logger.info({ dryRun: env.SEND_DRY_RUN }, "worker starting");

  const connection = createRedisConnection();
  connection.on("error", (err) => logger.error({ err }, "redis connection error"));

  const sendQueue = new Queue(QUEUE_NAMES.send, { connection });
  const sendWorker = registerSendWorker(connection);
  // Quota reset and inbox polling ride along inside the tick worker's own 60s loop instead of
  // running as their own BullMQ queues — see tick.ts for why (each extra queue with a
  // repeatable scheduler carries a fixed, un-tunable Redis-polling cost on serverless/
  // pay-per-command Redis like Upstash).
  const { worker: tickWorker } = await registerTickJob(connection, sendQueue);

  logger.info("worker ready — tick every 60s (also checks quota resets and due inbox polls)");

  const shutdown = async () => {
    logger.info("worker shutting down");
    await Promise.all([tickWorker.close(), sendWorker.close()]);
    await sendQueue.close();
    connection.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
