import { env } from "@dispatch/config";
import IORedis from "ioredis";

// BullMQ requires this exact setting — it manages its own retry/backoff semantics and will
// throw on boot if the underlying ioredis client retries requests on its own.
export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
