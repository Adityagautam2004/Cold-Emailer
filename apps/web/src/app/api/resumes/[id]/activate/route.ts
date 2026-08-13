import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { getOwnedResume } from "@/lib/resumes";

export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const resume = await getOwnedResume(user.id, id);

  if (resume.isArchived) {
    throw new ValidationError("Un-archive this resume before making it active.");
  }

  await prisma.$transaction([
    prisma.resume.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } }),
    prisma.resume.update({ where: { id: resume.id }, data: { isActive: true } }),
  ]);

  return NextResponse.json({ ok: true });
});
