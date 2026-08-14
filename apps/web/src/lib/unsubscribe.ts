import { env } from "@dispatch/config";
import { prisma, suppressEmailCascade } from "@dispatch/db";
import { verifyUnsubscribeToken } from "@dispatch/core";

export type UnsubscribeResult = { ok: true } | { ok: false };

/**
 * §13/§2.5 — the public, unauthenticated /u/[token] link. Verifying the token needs no DB
 * lookup (it's self-contained HMAC), so an invalid/tampered token is rejected before any
 * write. Idempotent by design: re-visiting the same link (a mail client retry, a person
 * clicking twice) upserts the same Suppression row rather than erroring.
 */
export async function processUnsubscribeToken(token: string): Promise<UnsubscribeResult> {
  const payload = verifyUnsubscribeToken(token, env.UNSUBSCRIBE_SECRET);
  if (!payload) return { ok: false };
  const { userId, email } = payload;

  await suppressEmailCascade(userId, email, "unsubscribed", { token });
  await prisma.event.create({ data: { userId, type: "unsubscribed", meta: { email } } });

  return { ok: true };
}
