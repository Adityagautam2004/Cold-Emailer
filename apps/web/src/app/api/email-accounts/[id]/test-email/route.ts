import { decrypt } from "@dispatch/core/src/crypto.js";
import { generateMessageId } from "@dispatch/core/src/message-id.js";
import { classifySendError } from "@dispatch/core/src/sender/errors.js";
import { createSender } from "@dispatch/core/src/sender/index.js";
import { env } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { friendlySmtpError, getOwnedEmailAccountForSending } from "@/lib/email-accounts";
import { requireUser } from "@/lib/require-user";

/**
 * Sends a test email to the mailbox's own address. This is what flips `verifiedAt` — an
 * account cannot back a campaign until this has succeeded once (§14 onboarding).
 */
export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const account = await getOwnedEmailAccountForSending(user.id, id);

  const secret = decrypt(account.credentialEnc);
  const sender = createSender({
    provider: "smtp",
    fromEmail: account.fromEmail,
    fromName: account.fromName,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    secret,
  });

  const messageId = generateMessageId(`verify-${account.id}`, new URL(env.APP_URL).hostname);

  try {
    await sender.send({
      to: account.fromEmail,
      toName: account.fromName,
      subject: "Dispatch: your mailbox is connected",
      text: `This is a test email confirming Dispatch can send from ${account.fromEmail}.\n\nIf you're reading this in your inbox, your mailbox is connected and ready to send campaigns.`,
      messageId,
    });
  } catch (err) {
    throw new ValidationError(friendlySmtpError(classifySendError(err)));
  } finally {
    await sender.close();
  }

  await prisma.emailAccount.update({ where: { id: account.id }, data: { verifiedAt: new Date() } });

  return NextResponse.json({ ok: true });
});
