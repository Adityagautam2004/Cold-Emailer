import "server-only";
import { prisma } from "@dispatch/db";
import { NotFoundError, ValidationError } from "./api-errors";

export async function getOwnedCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign || campaign.userId !== userId) {
    throw new NotFoundError("No campaign with that id.");
  }
  return campaign;
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface CampaignPaceInput {
  perDayCap: number;
  minGapMinutes: number;
  windowStart: string;
  windowEnd: string;
  daysOfWeek: number[];
}

/** Structural pace validation — independent of warmup, which is checked dynamically at send time. */
export function validatePace(input: CampaignPaceInput): void {
  if (input.perDayCap < 1 || input.perDayCap > 50) {
    throw new ValidationError("Per-day cap must be between 1 and 50.");
  }
  if (input.minGapMinutes < 1) {
    throw new ValidationError("Minimum gap must be at least 1 minute.");
  }
  if (!HHMM_RE.test(input.windowStart) || !HHMM_RE.test(input.windowEnd)) {
    throw new ValidationError('Window times must be "HH:mm".');
  }
  if (input.windowStart >= input.windowEnd) {
    throw new ValidationError("Window start must be before window end.");
  }
  if (input.daysOfWeek.length === 0 || input.daysOfWeek.some((d) => d < 1 || d > 7)) {
    throw new ValidationError("Pick at least one day of the week.");
  }
}

export interface StepInput {
  templateId: string;
  stepOrder: number;
  delayDays: number;
}

/** §10.3 — max 2 follow-ups, each at least 3 days after the previous step. */
export function validateSteps(steps: StepInput[]): void {
  if (steps.length === 0 || steps.length > 3) {
    throw new ValidationError("A campaign needs 1 to 3 steps (an initial send plus up to 2 follow-ups).");
  }
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  sorted.forEach((s, i) => {
    if (s.stepOrder !== i) {
      throw new ValidationError("Steps must be numbered 0, 1, 2 with no gaps.");
    }
    if (i === 0 && s.delayDays !== 0) {
      throw new ValidationError("The initial step has no delay.");
    }
    if (i > 0 && s.delayDays < 3) {
      throw new ValidationError("Follow-ups must be at least 3 days after the previous step.");
    }
  });
}
