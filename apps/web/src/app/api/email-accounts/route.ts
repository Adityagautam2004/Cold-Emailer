import { classifySendError, createSender, encrypt, nextLocalMidnight, warmupStage } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { friendlySmtpError, SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { requireUser } from "@/lib/require-user";

export const GET = apiRoute(async () => {
  const user = await requireUser();
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId: user.id },
    select: SAFE_EMAIL_ACCOUNT_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ emailAccounts });
});

const bodySchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().min(1).max(200),
  appPassword: z.string().min(1),
});

export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the form and try again.", parsed.error.flatten());
  }

  const fromEmail = parsed.data.fromEmail.toLowerCase().trim();
  const fromName = parsed.data.fromName.trim();
  // Gmail app passwords are shown with spaces for readability; they don't matter.
  const appPassword = parsed.data.appPassword.replace(/\s+/g, "");

  const existing = await prisma.emailAccount.findUnique({
    where: { userId_fromEmail: { userId: user.id, fromEmail } },
  });
  if (existing) {
    throw new ValidationError("This mailbox is already connected.");
  }

  const smtpHost = "smtp.gmail.com";
  const smtpPort = 465;

  const sender = createSender({ provider: "smtp", fromEmail, fromName, smtpHost, smtpPort, secret: appPassword });
  try {
    await sender.verify();
  } catch (err) {
    throw new ValidationError(friendlySmtpError(classifySendError(err)));
  } finally {
    await sender.close();
  }

  const now = new Date();
  const account = await prisma.emailAccount.create({
    data: {
      userId: user.id,
      provider: "smtp",
      fromEmail,
      fromName,
      credentialEnc: encrypt(appPassword),
      smtpHost,
      smtpPort,
      dailyCap: warmupStage(now, now).cap,
      quotaResetAt: nextLocalMidnight(user.timezone, now),
      warmupStartedAt: now,
      status: "active",
    },
    select: SAFE_EMAIL_ACCOUNT_SELECT,
  });

  return NextResponse.json({ emailAccount: account });
});
