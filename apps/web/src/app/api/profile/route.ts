import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  college: z.string().min(1).max(200),
  timezone: z.string().min(1).max(100),
});

export const PATCH = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the form and try again.", parsed.error.flatten());
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { id: true, name: true, college: true, timezone: true },
  });

  return NextResponse.json({ user: updated });
});
