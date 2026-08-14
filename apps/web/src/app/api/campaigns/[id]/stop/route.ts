import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

/** Terminal, unlike pause — cancels every remaining queued/claimed send. There is no un-stop. */
export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  if (campaign.status === "stopped" || campaign.status === "completed") {
    return NextResponse.json({ campaign });
  }
  if (campaign.status !== "running" && campaign.status !== "paused") {
    throw new ValidationError(`Campaign is ${campaign.status} and can't be stopped.`);
  }

  const [updated] = await prisma.$transaction([
    prisma.campaign.update({ where: { id: campaign.id }, data: { status: "stopped" } }),
    prisma.send.updateMany({
      where: { campaignId: campaign.id, status: { in: ["queued", "claimed"] } },
      data: { status: "cancelled" },
    }),
  ]);

  return NextResponse.json({ campaign: updated });
});
