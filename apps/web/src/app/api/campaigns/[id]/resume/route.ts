import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  if (campaign.status !== "paused") {
    throw new ValidationError(`Campaign is ${campaign.status}, not paused.`);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "running", pauseReason: null },
  });

  return NextResponse.json({ campaign: updated });
});
