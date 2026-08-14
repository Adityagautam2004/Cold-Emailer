import { hasPersonalizationVariable, validateContactsAgainstTemplate } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { validatePace, validateSteps } from "@/lib/campaigns";
import { getOwnedEmailAccount } from "@/lib/email-accounts";
import { getOwnedList } from "@/lib/lists";
import { requireUser } from "@/lib/require-user";
import { getOwnedResume } from "@/lib/resumes";
import { getOwnedTemplate } from "@/lib/templates";

export const GET = apiRoute(async () => {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true } }, steps: true },
  });
  return NextResponse.json({ campaigns });
});

const stepSchema = z.object({
  templateId: z.string().min(1),
  stepOrder: z.number().int().min(0).max(2),
  delayDays: z.number().int().min(0).max(30),
});

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  listId: z.string().min(1),
  resumeId: z.string().min(1),
  emailAccountId: z.string().min(1),
  steps: z.array(stepSchema).min(1).max(3),
  perDayCap: z.number().int(),
  minGapMinutes: z.number().int(),
  windowStart: z.string(),
  windowEnd: z.string(),
  daysOfWeek: z.array(z.number().int()),
  timezone: z.string().min(1),
  attachResume: z.boolean().default(true),
});

/**
 * Creates a campaign in `draft` — full validation happens here, including the §12
 * per-contact template check and the §2.4 personalisation-variable hard rule, so the
 * wizard's review step gets exact, actionable errors before anything is committed.
 * No Send rows are created yet — that's POST /[id]/start, kept as its own idempotent step.
 */
export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the campaign settings and try again.", parsed.error.flatten());
  }
  const data = parsed.data;

  validatePace(data);
  validateSteps(data.steps);

  const [list, resume, emailAccount] = await Promise.all([
    getOwnedList(user.id, data.listId),
    getOwnedResume(user.id, data.resumeId),
    getOwnedEmailAccount(user.id, data.emailAccountId),
  ]);

  if (!emailAccount.verifiedAt) {
    throw new ValidationError("Verify your mailbox (send yourself a test email) before starting a campaign.");
  }

  const templates = await Promise.all(data.steps.map((s) => getOwnedTemplate(user.id, s.templateId)));

  for (const template of templates) {
    if (!hasPersonalizationVariable(template.bodyText)) {
      throw new ValidationError(
        `Template "${template.name}" has no personalisation variable — add {{hr_name}}, {{company}}, {{title}}, or a custom field before it can be used in a campaign.`
      );
    }
  }

  const rawContacts = await prisma.contact.findMany({
    where: { listId: list.id },
    select: { rowNumber: true, email: true, hrName: true, company: true, title: true, custom: true },
  });
  // Contact.custom is always written as a plain object (see POST /api/lists) — Prisma's
  // JsonValue type is just wider than that in the general case.
  const contacts = rawContacts.map((c) => ({ ...c, custom: c.custom as Record<string, unknown> }));

  const sender = { myName: user.name ?? "", myCollege: user.college };
  const unresolvedByStep = data.steps.map((step, i) => ({
    stepOrder: step.stepOrder,
    rows: validateContactsAgainstTemplate(templates[i].subject, templates[i].bodyText, contacts, sender),
  }));
  const anyUnresolved = unresolvedByStep.find((s) => s.rows.length > 0);
  if (anyUnresolved) {
    throw new ValidationError(
      `Step ${anyUnresolved.stepOrder + 1}'s template would produce an unfilled variable for ${anyUnresolved.rows.length} contact(s).`,
      { stepOrder: anyUnresolved.stepOrder, rows: anyUnresolved.rows.slice(0, 20) }
    );
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        userId: user.id,
        listId: list.id,
        resumeId: resume.id,
        emailAccountId: emailAccount.id,
        name: data.name,
        perDayCap: data.perDayCap,
        minGapMinutes: data.minGapMinutes,
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        daysOfWeek: data.daysOfWeek,
        timezone: data.timezone,
        attachResume: data.attachResume,
        status: "draft",
      },
    });
    await tx.campaignStep.createMany({
      data: data.steps.map((s, i) => ({
        campaignId: created.id,
        templateId: s.templateId,
        stepOrder: s.stepOrder,
        delayDays: i === 0 ? 0 : s.delayDays,
      })),
    });
    return created;
  });

  return NextResponse.json({ campaign });
});
