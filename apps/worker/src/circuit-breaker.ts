import { logger } from "@dispatch/config";
import { prisma } from "@dispatch/db";

const MIN_SENDS = 20;
const MAX_BOUNCE_RATE = 0.05;

/**
 * §2.8 — checked after every send that could plausibly move the bounce rate (a permanent
 * failure at SMTP time here, or a DSN-parsed bounce in Phase 6's poll-inbox job). The
 * denominator is every Send that reached a final outcome (`sent` or `failed`) for this
 * campaign; the numerator is how many of those contacts ended up `bounced`. Below 20
 * resolved sends the rate is too noisy to act on — a single early bounce would trip it.
 */
export async function checkCircuitBreaker(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "running") return;

  const resolved = await prisma.send.findMany({
    where: { campaignId, status: { in: ["sent", "failed"] } },
    select: { contactId: true },
  });
  if (resolved.length < MIN_SENDS) return;

  const bouncedCount = await prisma.contact.count({
    where: { id: { in: resolved.map((s) => s.contactId) }, status: "bounced" },
  });

  const rate = bouncedCount / resolved.length;
  if (rate > MAX_BOUNCE_RATE) {
    const reason = `Bounce rate ${(rate * 100).toFixed(1)}% over ${resolved.length} sends — paused automatically.`;
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "paused", pauseReason: reason } });
    logger.warn({ campaignId, rate, resolved: resolved.length }, "circuit breaker tripped");
  }
}
