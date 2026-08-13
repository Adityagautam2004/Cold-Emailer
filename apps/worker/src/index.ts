import { env, logger } from "@dispatch/config";
import { createRedisConnection } from "./redis.js";
import { registerTickJob } from "./jobs/tick.js";

async function main() {
  logger.info({ dryRun: env.SEND_DRY_RUN }, "worker starting");

  const connection = createRedisConnection();
  connection.on("error", (err) => logger.error({ err }, "redis connection error"));

  const { worker: tickWorker } = await registerTickJob(connection);

  logger.info("worker ready — tick scheduled every 60s");

  const shutdown = async () => {
    logger.info("worker shutting down");
    await tickWorker.close();
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
