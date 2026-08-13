import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { getOwnedResume } from "@/lib/resumes";

/** Archiving, not deleting — a resume already used by a campaign must stay readable for that campaign's history (§14). This only hides it from future selection. */
export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const resume = await getOwnedResume(user.id, id);

  await prisma.resume.update({
    where: { id: resume.id },
    data: { isArchived: true, isActive: false },
  });

  return NextResponse.json({ ok: true });
});
