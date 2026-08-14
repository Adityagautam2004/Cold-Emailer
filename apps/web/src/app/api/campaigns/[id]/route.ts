import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

export const GET = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  const statusCounts = await prisma.send.groupBy({
    by: ["status"],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  });

  const stats = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  return NextResponse.json({ campaign, stats });
});
