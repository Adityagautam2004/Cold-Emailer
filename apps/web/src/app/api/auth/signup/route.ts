import { prisma } from "@dispatch/db";
import argon2 from "argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/** Credentials-provider signup — the only route in this app allowed to run before a session exists. */
export const POST = apiRoute(async (req: Request) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the form and try again.", parsed.error.flatten());
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ValidationError("An account with that email already exists — sign in instead.");
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash },
  });

  return NextResponse.json({ ok: true });
});
