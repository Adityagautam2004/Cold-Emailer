import { createHmac, timingSafeEqual } from "node:crypto";

export interface UnsubscribePayload {
  userId: string;
  email: string;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * A compact, stateless, HMAC-signed token — verifiable without a DB lookup. Needed at
 * send time (§8.3, every email) well before the public /u/[token] page exists to consume
 * it (Phase 6). Encodes userId+email so the unsubscribe handler can create the
 * Suppression row without first looking anything up.
 */
export function generateUnsubscribeToken(input: UnsubscribePayload, secret: string): string {
  const payload = `${input.userId}:${input.email}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(payload, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribePayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const colon = payload.indexOf(":");
  if (colon === -1) return null;
  return { userId: payload.slice(0, colon), email: payload.slice(colon + 1) };
}

export function buildUnsubscribeUrl(appUrl: string, input: UnsubscribePayload, secret: string): string {
  const token = generateUnsubscribeToken(input, secret);
  return new URL(`/u/${token}`, appUrl).toString();
}
