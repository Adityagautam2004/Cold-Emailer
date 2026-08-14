import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

/** Pausing just stops the tick from claiming this campaign's sends (§10.2 requires c.status='running'); nothing already queued is touched, so resuming picks up exactly where it left off. */
export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  if (campaign.status !== "running") {
    throw new ValidationError(`Campaign is ${campaign.status}, not running.`);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "paused", pauseReason: "paused by user" },
  });

  return NextResponse.json({ campaign: updated });
});
