import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { getOwnedCampaign, startCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  const result = await startCampaign(campaign);
  return NextResponse.json(result);
});
