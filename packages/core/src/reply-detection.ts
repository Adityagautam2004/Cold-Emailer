const MESSAGE_ID_RE = /<[^<>\s]+>/g;

/**
 * §13.1 — the join key for reply detection. `In-Reply-To` and `References` headers can
 * each hold zero, one, or several angle-bracketed Message-IDs (References is a
 * space-separated history of the whole thread); we only need the flat set of every
 * Message-ID either header mentions, to check each one against `Send.providerMessageId`.
 */
export function extractReferencedMessageIds(inReplyTo?: string | string[] | null, references?: string | string[] | null): string[] {
  const raw = [inReplyTo, references]
    .flat()
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
  const found = raw.match(MESSAGE_ID_RE) ?? [];
  return [...new Set(found)];
}

const BOUNCE_LOCAL_PARTS = new Set(["mailer-daemon", "postmaster"]);

/** §13.4 — the two conventional signals a message is a bounce/DSN rather than a real reply. */
export function isBounceSenderAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const local = address.split("@")[0]?.toLowerCase();
  return local != null && BOUNCE_LOCAL_PARTS.has(local);
}

export function isDsnContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized.includes("multipart/report") && normalized.includes("report-type=delivery-status");
}

/**
 * Parses the `message/delivery-status` MIME part of a DSN (RFC 3464) — a flat block of
 * `Key: value` lines, not a real email. `Final-Recipient` (falling back to
 * `Original-Recipient`) is `rfc822;user@example.com` or occasionally bare, per the RFC.
 */
export function parseDsnRecipient(deliveryStatusText: string): string | null {
  const match = /(?:Final-Recipient|Original-Recipient)\s*:\s*(?:rfc822;)?\s*([^\s;]+@[^\s;>"]+)/i.exec(deliveryStatusText);
  return match ? match[1].trim().toLowerCase() : null;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Fallback for bounce messages whose provider didn't attach a proper `message/delivery-status`
 * part (real-world DSNs are inconsistent about this) — scan the human-readable body for the
 * first email address that isn't a generic mailer address or the receiving mailbox itself.
 */
export function extractLikelyBouncedRecipient(bodyText: string, ownAddress: string): string | null {
  const matches = bodyText.match(EMAIL_RE) ?? [];
  const own = ownAddress.toLowerCase();
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (lower === own) continue;
    const local = lower.split("@")[0];
    if (BOUNCE_LOCAL_PARTS.has(local)) continue;
    return lower;
  }
  return null;
}
