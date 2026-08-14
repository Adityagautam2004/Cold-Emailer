import { prisma } from "@dispatch/db";

/**
 * §8.2/§13 — shared by the send worker (SMTP auth failure) and poll-inbox (IMAP auth
 * failure): either one means this mailbox's stored credential no longer works, so every
 * running campaign on it must stop rather than keep failing sends or missing replies
 * silently. The account surfaces as `status: 'error'` in Settings until the student
 * reconnects (generates a fresh app password).
 */
export async function pauseAccountOnError(accountId: string, userId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.emailAccount.update({ where: { id: accountId }, data: { status: "error", statusReason: reason } }),
    prisma.campaign.updateMany({ where: { emailAccountId: accountId, status: "running" }, data: { status: "paused", pauseReason: reason } }),
    prisma.event.create({ data: { userId, type: "account_error", meta: { reason } } }),
  ]);
}
