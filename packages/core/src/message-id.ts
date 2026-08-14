import { randomBytes } from "node:crypto";

/**
 * `<{sendId}.{random}@{domain}>` — this is the join key for reply detection, so it must be
 * unique per send. Kept in its own file (not mail.ts) purely so the `node:crypto` import
 * doesn't end up in the main @dispatch/core barrel — see index.ts's comment on why that
 * barrel stays free of anything that needs a real Node built-in. Server-only code imports
 * this by direct subpath: @dispatch/core/src/message-id.js.
 */
export function generateMessageId(sendId: string, domain: string): string {
  const random = randomBytes(8).toString("hex");
  return `<${sendId}.${random}@${domain}>`;
}
