import "server-only";
import { prisma } from "@dispatch/db";
import type { ClassifiedError } from "@dispatch/core";
import { NotFoundError } from "./api-errors";

/**
 * The explicit `select` that every route returning an EmailAccount must use. `credentialEnc`
 * is never in this list — see §7. Add fields here, never `select: undefined` / spread the
 * whole row, so a future field addition can't accidentally leak the credential.
 */
export const SAFE_EMAIL_ACCOUNT_SELECT = {
  id: true,
  provider: true,
  fromEmail: true,
  fromName: true,
  smtpHost: true,
  smtpPort: true,
  imapHost: true,
  dailyCap: true,
  sentToday: true,
  quotaResetAt: true,
  warmupStartedAt: true,
  status: true,
  statusReason: true,
  verifiedAt: true,
  lastPolledAt: true,
  createdAt: true,
} as const;

export async function getOwnedEmailAccount(userId: string, accountId: string) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    select: { userId: true, ...SAFE_EMAIL_ACCOUNT_SELECT },
  });
  if (!account || account.userId !== userId) {
    throw new NotFoundError("No connected mailbox with that id.");
  }
  return account;
}

/**
 * Loads the row WITH `credentialEnc` for the one legitimate purpose: decrypting it
 * server-side to send or poll. Callers must never serialize the return value directly in
 * an API response — decrypt, use, discard.
 */
export async function getOwnedEmailAccountForSending(userId: string, accountId: string) {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    throw new NotFoundError("No connected mailbox with that id.");
  }
  return account;
}

export function friendlySmtpError(classified: ClassifiedError): string {
  switch (classified.class) {
    case "account":
      return "Gmail rejected the app password. Generate a new one and reconnect.";
    case "transient":
      return "Couldn't reach Gmail's servers just now. Try again in a moment.";
    case "permanent":
      return "Gmail rejected that address. Double-check it and try again.";
  }
}
