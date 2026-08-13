import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { getOwnedResume } from "@/lib/resumes";
import { resumeStorage } from "@/lib/storage";

export const GET = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const resume = await getOwnedResume(user.id, id);

  const url = await resumeStorage.createDownloadUrl(resume.storageKey, 60);
  return NextResponse.json({ url });
});
