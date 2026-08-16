import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { resumeStorage } from "@/lib/storage";

const bodySchema = z.object({
  // Required, not just a confirm click — this is the single most destructive action in the
  // app, and typing the account's own email is a much harder accident to have than a click.
  email: z.string(),
});

/**
 * Full self-service account deletion (§14, and promised verbatim in /terms and /privacy).
 * Two things Prisma's own cascades can't do for us:
 *
 * 1. Deletion order. Campaign -> ContactList/Resume/EmailAccount and CampaignStep -> Template
 *    are deliberately `onDelete: Restrict` (a template/list/resume/mailbox still referenced by
 *    a campaign should never silently vanish out from under it) — see tick.test.ts's afterAll
 *    comment for the same reasoning applied to test cleanup. That means a bare
 *    `prisma.user.delete()` can hit a restrict violation via Postgres processing the
 *    Campaign/Template cascade branches in an order we don't control. Deleting every Campaign
 *    first (which itself cascades CampaignStep and Send) clears every one of those Restrict
 *    blockers, so the User cascade that follows has nothing left to conflict with.
 * 2. Object storage. Resume files live in Supabase storage under `{userId}/...` — deleting the
 *    `resumes` DB rows never touches the actual files. `removeAllForUser` wipes that whole
 *    prefix; done before the DB deletion so a transient storage failure aborts before any data
 *    is gone (safe to just retry the whole request).
 */
export const DELETE = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || parsed.data.email.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new ValidationError("Type your account email exactly to confirm.");
  }

  await resumeStorage.removeAllForUser(user.id);

  await prisma.$transaction([
    prisma.campaign.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
});
