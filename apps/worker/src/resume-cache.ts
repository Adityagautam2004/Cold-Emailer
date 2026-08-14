import { logger } from "@dispatch/config";
import { LRUCache } from "lru-cache";
import { resumeStorage } from "./storage.js";

interface CachedResume {
  buffer: Buffer;
  updatedAt: number;
}

/**
 * §8.4 — without this, every send re-downloads the same handful of PDFs from Supabase
 * Storage. At 300 students x 20 sends/day that's ~3 GB/day of storage egress for what's
 * really the same files over and over. 25 entries, 30-minute TTL; invalidated early if the
 * resume's own `updatedAt` moves (a re-upload mid-campaign), not just on TTL expiry.
 */
const cache = new LRUCache<string, CachedResume>({
  max: 25,
  ttl: 30 * 60 * 1000,
});

export async function getResumeBuffer(resumeId: string, storageKey: string, updatedAt: Date): Promise<Buffer> {
  const hit = cache.get(resumeId);
  if (hit && hit.updatedAt === updatedAt.getTime()) {
    logger.debug({ resumeId }, "resume cache hit");
    return hit.buffer;
  }

  logger.debug({ resumeId, reason: hit ? "stale version" : "miss" }, "resume cache miss");
  const buffer = await resumeStorage.download(storageKey);
  cache.set(resumeId, { buffer, updatedAt: updatedAt.getTime() });
  return buffer;
}
