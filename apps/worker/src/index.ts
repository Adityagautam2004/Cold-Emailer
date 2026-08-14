import { env, logger } from "@dispatch/config";
import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.js";
import { QUEUE_NAMES } from "./queues.js";
import { registerTickJob } from "./jobs/tick.js";
import { registerSendWorker } from "./jobs/send.js";
import { registerResetQuotaJob } from "./jobs/reset-quota.js";
import { registerPollInboxJob } from "./jobs/poll-inbox.js";

async function main() {
  logger.info({ dryRun: env.SEND_DRY_RUN }, "worker starting");

  const connection = createRedisConnection();
  connection.on("error", (err) => logger.error({ err }, "redis connection error"));

  const sendQueue = new Queue(QUEUE_NAMES.send, { connection });
  const sendWorker = registerSendWorker(connection);
  const { worker: tickWorker } = await registerTickJob(connection, sendQueue);
  const { worker: resetQuotaWorker } = await registerResetQuotaJob(connection);
  const { worker: pollInboxWorker } = await registerPollInboxJob(connection);

  logger.info("worker ready — tick every 60s, quota reset every 15m, inbox poll every 15m per account");

  const shutdown = async () => {
    logger.info("worker shutting down");
    await Promise.all([tickWorker.close(), sendWorker.close(), resetQuotaWorker.close(), pollInboxWorker.close()]);
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
