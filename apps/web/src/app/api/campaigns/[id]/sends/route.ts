import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

export const GET = apiRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const sends = await prisma.send.findMany({
    where: { campaignId: campaign.id },
    orderBy: { scheduledAt: "asc" },
    skip: offset,
    take: limit,
    include: {
      contact: { select: { email: true, hrName: true, company: true } },
      step: { select: { stepOrder: true } },
    },
  });

  return NextResponse.json({ sends });
});
