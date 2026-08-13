import { SmtpSender } from "./smtp.js";
import type { EmailSender, SenderCredentials } from "./types.js";

/**
 * The only place that knows which concrete sender implementation to build. §16 phase 8 adds
 * a "gmail_oauth" branch here (a Gmail API sender) — nothing outside this factory should ever
 * branch on `provider`, that's the whole point of the interface.
 */
export function createSender(creds: SenderCredentials): EmailSender {
  switch (creds.provider) {
    case "smtp":
      return new SmtpSender(creds);
    case "gmail_oauth":
      throw new Error("gmail_oauth sender is not enabled — see §16 phase 8 in BUILD_SPEC.md");
    default:
      throw new Error(`unknown sender provider: ${creds.provider satisfies never}`);
  }
}

export type { EmailSender, OutgoingEmail, SendResult, SenderCredentials } from "./types.js";
export { SmtpSender } from "./smtp.js";
