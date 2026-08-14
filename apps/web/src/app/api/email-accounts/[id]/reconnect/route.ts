import { classifySendError, createSender, encrypt } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { friendlySmtpError, getOwnedEmailAccountForSending, SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { requireUser } from "@/lib/require-user";

const bodySchema = z.object({ appPassword: z.string().min(1) });

/**
 * Re-authenticates the same mailbox with a new app password (e.g. after Gmail revoked the
 * old one). Deliberately does not touch `warmupStartedAt` — this is the same mailbox with
 * the same sending history, not a new account, so the warmup ramp shouldn't restart.
 */
export const POST = apiRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const account = await getOwnedEmailAccountForSending(user.id, id);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Enter the new app password.", parsed.error.flatten());
  }
  const appPassword = parsed.data.appPassword.replace(/\s+/g, "");

  const sender = createSender({
    provider: "smtp",
    fromEmail: account.fromEmail,
    fromName: account.fromName,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    secret: appPassword,
  });
  try {
    await sender.verify();
  } catch (err) {
    throw new ValidationError(friendlySmtpError(classifySendError(err)));
  } finally {
    await sender.close();
  }

  const updated = await prisma.emailAccount.update({
    where: { id: account.id },
    data: { credentialEnc: encrypt(appPassword), status: "active", statusReason: null },
    select: SAFE_EMAIL_ACCOUNT_SELECT,
  });

  return NextResponse.json({ emailAccount: updated });
});
