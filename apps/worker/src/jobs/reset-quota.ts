import { nextLocalMidnight } from "@dispatch/core";
import { prisma } from "@dispatch/db";

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
