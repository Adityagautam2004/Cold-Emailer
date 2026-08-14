import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getCampaignStats, getOwnedCampaign, startCampaign, validatePace, validateSteps } from "./campaigns";
import { NotFoundError, ValidationError } from "./api-errors";

const stamp = Date.now();

describe("validatePace (structural, no DB)", () => {
  const valid = { perDayCap: 20, minGapMinutes: 6, windowStart: "10:00", windowEnd: "18:00", daysOfWeek: [1, 2, 3, 4, 5] };

  it("accepts a valid pace", () => {
    expect(() => validatePace(valid)).not.toThrow();
  });

  it("rejects a per-day cap above the hard 50 ceiling (§2.2)", () => {
    expect(() => validatePace({ ...valid, perDayCap: 51 })).toThrow(ValidationError);
  });

  it("rejects a window where start is not before end", () => {
    expect(() => validatePace({ ...valid, windowStart: "18:00", windowEnd: "10:00" })).toThrow(ValidationError);
  });

  it("rejects an empty daysOfWeek", () => {
    expect(() => validatePace({ ...valid, daysOfWeek: [] })).toThrow(ValidationError);
  });
});

describe("validateSteps (§10.3, no DB)", () => {
  it("accepts a single initial step", () => {
    expect(() => validateSteps([{ templateId: "t1", stepOrder: 0, delayDays: 0 }])).not.toThrow();
  });

  it("accepts up to 2 follow-ups at least 3 days apart", () => {
    expect(() =>
      validateSteps([
        { templateId: "t1", stepOrder: 0, delayDays: 0 },
        { templateId: "t2", stepOrder: 1, delayDays: 3 },
        { templateId: "t3", stepOrder: 2, delayDays: 4 },
      ])
    ).not.toThrow();
  });

  it("rejects a follow-up delayed less than 3 days", () => {
    expect(() =>
      validateSteps([
        { templateId: "t1", stepOrder: 0, delayDays: 0 },
        { templateId: "t2", stepOrder: 1, delayDays: 2 },
      ])
    ).toThrow(ValidationError);
  });

  it("rejects more than 2 follow-ups", () => {
    expect(() =>
      validateSteps([
        { templateId: "t1", stepOrder: 0, delayDays: 0 },
        { templateId: "t2", stepOrder: 1, delayDays: 3 },
        { templateId: "t3", stepOrder: 2, delayDays: 3 },
        { templateId: "t4", stepOrder: 3, delayDays: 3 },
      ])
    ).toThrow(ValidationError);
  });
});

describe("campaigns.ts (integration, §19)", () => {
  let userA: string;
  let userB: string;
  let listId: string;
  let resumeId: string;
  let templateId: string;
  let emailAccountId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({ data: { email: `campaigns-test-a-${stamp}-${randomUUID()}@example.com` } });
    const b = await prisma.user.create({ data: { email: `campaigns-test-b-${stamp}-${randomUUID()}@example.com` } });
    userA = a.id;
    userB = b.id;

    const resume = await prisma.resume.create({ data: { userId: userA, storageKey: `${userA}/r.pdf`, filename: "r.pdf", sizeBytes: 10 } });
    resumeId = resume.id;
    const account = await prisma.emailAccount.create({
      data: { userId: userA, fromEmail: `campaigns-${randomUUID()}@gmail.com`, fromName: "T", credentialEnc: "v1.a.b.c", quotaResetAt: new Date() },
    });
    emailAccountId = account.id;
    const list = await prisma.contactList.create({ data: { userId: userA, name: "L", sourceFilename: "x.csv" } });
    listId = list.id;
    const template = await prisma.template.create({ data: { userId: userA, name: "T", subject: "S {{company}}", bodyText: "B {{hr_name}}" } });
    templateId = template.id;
  });

  afterAll(async () => {
    // Fixture emails are `campaigns-test-a-${stamp}-...`/`campaigns-test-b-${stamp}-...` — the
    // "a"/"b" infix means a naive `campaigns-test-${stamp}` substring never matches either.
    const users = await prisma.user.findMany({ where: { email: { contains: String(stamp) } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.campaign.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("getOwnedCampaign enforces ownership — 404 for another user's campaign", async () => {
    const campaign = await prisma.campaign.create({
      data: { userId: userA, listId, resumeId, emailAccountId, name: "C", status: "draft" },
    });
    await expect(getOwnedCampaign(userA, campaign.id)).resolves.toMatchObject({ id: campaign.id });
    await expect(getOwnedCampaign(userB, campaign.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("starting a campaign creates exactly one Send per pending contact", async () => {
    const contacts = await Promise.all(
      Array.from({ length: 5 }, (_, i) => prisma.contact.create({ data: { listId, email: `n-${stamp}-${i}@acmecorp.com`, status: "pending", rowNumber: i } }))
    );
    const campaign = await prisma.campaign.create({
      data: { userId: userA, listId, resumeId, emailAccountId, name: "C", status: "draft" },
    });
    await prisma.campaignStep.create({ data: { campaignId: campaign.id, templateId, stepOrder: 0 } });

    const owned = await getOwnedCampaign(userA, campaign.id);
    const result = await startCampaign(owned);

    expect(result.sendsCreated).toBe(5);
    expect(result.campaign.status).toBe("running");

    const sends = await prisma.send.findMany({ where: { campaignId: campaign.id } });
    expect(sends).toHaveLength(5);
    const contactIds = new Set(contacts.map((c) => c.id));
    expect(new Set(sends.map((s) => s.contactId))).toEqual(contactIds);
  });

  it("starting twice creates no duplicate Send rows (idempotent)", async () => {
    await Promise.all(
      Array.from({ length: 3 }, (_, i) => prisma.contact.create({ data: { listId, email: `dup-${stamp}-${i}@acmecorp.com`, status: "pending", rowNumber: i } }))
    );
    const campaign = await prisma.campaign.create({
      data: { userId: userA, listId, resumeId, emailAccountId, name: "C", status: "draft" },
    });
    await prisma.campaignStep.create({ data: { campaignId: campaign.id, templateId, stepOrder: 0 } });

    const owned1 = await getOwnedCampaign(userA, campaign.id);
    const first = await startCampaign(owned1);
    expect(first.sendsCreated).toBe(3);

    const owned2 = await getOwnedCampaign(userA, campaign.id);
    const second = await startCampaign(owned2);
    expect(second.alreadyStarted).toBe(true);

    const sends = await prisma.send.count({ where: { campaignId: campaign.id } });
    expect(sends).toBe(3);
  });

  it("getCampaignStats counts replied via Contact.status, not Send.status", async () => {
    const contactReplied = await prisma.contact.create({ data: { listId, email: `stats-replied-${stamp}@acmecorp.com`, status: "replied", rowNumber: 1 } });
    const contactSent = await prisma.contact.create({ data: { listId, email: `stats-sent-${stamp}@acmecorp.com`, status: "sent", rowNumber: 2 } });
    const campaign = await prisma.campaign.create({
      data: { userId: userA, listId, resumeId, emailAccountId, name: "C", status: "running" },
    });
    const step = await prisma.campaignStep.create({ data: { campaignId: campaign.id, templateId, stepOrder: 0 } });
    await prisma.send.createMany({
      data: [
        { campaignId: campaign.id, contactId: contactReplied.id, stepId: step.id, scheduledAt: new Date(), status: "sent" },
        { campaignId: campaign.id, contactId: contactSent.id, stepId: step.id, scheduledAt: new Date(), status: "sent" },
      ],
    });

    const stats = await getCampaignStats(campaign.id, listId);
    expect(stats.total).toBe(2);
    expect(stats.sent).toBe(2);
    expect(stats.replied).toBe(1);
  });
});
