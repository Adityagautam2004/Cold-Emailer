import { computeSlots } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";

/**
 * Generates every step-0 Send row up front (§5) and flips the campaign to running.
 * Idempotent by construction: `createMany` with `skipDuplicates` relies on the same
 * `@@unique([campaignId, contactId, stepId])` constraint the spec calls out, so a double
 * click (two concurrent requests both passing the status check) just no-ops the second
 * write instead of duplicating sends.
 */
export const POST = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const campaign = await getOwnedCampaign(user.id, id);

  if (campaign.status === "running") {
    return NextResponse.json({ campaign, alreadyStarted: true });
  }
  if (campaign.status !== "draft") {
    throw new ValidationError(`Campaign is ${campaign.status} and can't be started.`);
  }

  const step0 = campaign.steps.find((s) => s.stepOrder === 0);
  if (!step0) {
    throw new ValidationError("Campaign has no initial step.");
  }

  const contacts = await prisma.contact.findMany({
    where: { listId: campaign.listId, status: "pending" },
    orderBy: { rowNumber: "asc" },
    select: { id: true },
  });

  const slots = computeSlots({
    count: contacts.length,
    startFrom: new Date(),
    perDayCap: campaign.perDayCap,
    minGapMinutes: campaign.minGapMinutes,
    windowStart: campaign.windowStart,
    windowEnd: campaign.windowEnd,
    daysOfWeek: campaign.daysOfWeek,
    timezone: campaign.timezone,
  });

  if (contacts.length > 0) {
    await prisma.send.createMany({
      data: contacts.map((contact, i) => ({
        campaignId: campaign.id,
        contactId: contact.id,
        stepId: step0.id,
        scheduledAt: slots[i],
        status: "queued" as const,
      })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "running", startedAt: campaign.startedAt ?? new Date() },
  });

  return NextResponse.json({ campaign: updated, sendsCreated: contacts.length });
});
