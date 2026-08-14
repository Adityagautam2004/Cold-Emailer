import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import { afterAll, describe, expect, it } from "vitest";
import { checkCircuitBreaker } from "./circuit-breaker.js";

const stamp = Date.now();

async function makeCampaignFixture(status: "running" | "paused" = "running") {
  const user = await prisma.user.create({ data: { email: `cb-test-${stamp}-${randomUUID()}@example.com` } });
  const resume = await prisma.resume.create({ data: { userId: user.id, storageKey: `${user.id}/r.pdf`, filename: "r.pdf", sizeBytes: 10 } });
  const account = await prisma.emailAccount.create({
    data: { userId: user.id, fromEmail: `cb-${randomUUID()}@gmail.com`, fromName: "T", credentialEnc: "v1.a.b.c", quotaResetAt: new Date() },
  });
  const list = await prisma.contactList.create({ data: { userId: user.id, name: "L", sourceFilename: "x.csv" } });
  const template = await prisma.template.create({ data: { userId: user.id, name: "T", subject: "S {{company}}", bodyText: "B {{hr_name}}" } });
  const campaign = await prisma.campaign.create({
    data: { userId: user.id, listId: list.id, resumeId: resume.id, emailAccountId: account.id, name: "C", status },
  });
  const step = await prisma.campaignStep.create({ data: { campaignId: campaign.id, templateId: template.id, stepOrder: 0 } });
  return { userId: user.id, listId: list.id, campaignId: campaign.id, stepId: step.id };
}

/** Bulk-inserted (createMany, not N sequential round trips) — the pooled dev connection has shown resets under many rapid sequential writes (see DECISIONS.md). */
async function addResolvedSends(listId: string, campaignId: string, stepId: string, sentCount: number, bouncedCount: number) {
  const sentContacts = Array.from({ length: sentCount }, (_, i) => ({
    listId,
    email: `sent-${stamp}-${randomUUID()}@example.com`,
    status: "sent",
    rowNumber: i,
  }));
  const bouncedContacts = Array.from({ length: bouncedCount }, (_, i) => ({
    listId,
    email: `bounced-${stamp}-${randomUUID()}@example.com`,
    status: "bounced",
    rowNumber: i,
  }));
  const allContacts = [...sentContacts, ...bouncedContacts];
  if (allContacts.length === 0) return;

  await prisma.contact.createMany({ data: allContacts });
  const created = await prisma.contact.findMany({
    where: { email: { in: allContacts.map((c) => c.email) } },
    select: { id: true, email: true },
  });
  const idByEmail = new Map(created.map((c) => [c.email, c.id]));

  await prisma.send.createMany({
    data: [
      ...sentContacts.map((c) => ({ campaignId, contactId: idByEmail.get(c.email)!, stepId, scheduledAt: new Date(), status: "sent" })),
      ...bouncedContacts.map((c) => ({ campaignId, contactId: idByEmail.get(c.email)!, stepId, scheduledAt: new Date(), status: "failed" })),
    ],
  });
}

describe("checkCircuitBreaker (§2.8)", () => {
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: `cb-test-${stamp}` } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.campaign.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("does not trip below the 20-resolved-send minimum, even at 100% bounce rate", async () => {
    const fx = await makeCampaignFixture();
    await addResolvedSends(fx.listId, fx.campaignId, fx.stepId, 0, 10);

    await checkCircuitBreaker(fx.campaignId);

    const campaign = await prisma.campaign.findUnique({ where: { id: fx.campaignId } });
    expect(campaign?.status).toBe("running");
  });

  it("does not trip at or below a 5% bounce rate with enough volume", async () => {
    const fx = await makeCampaignFixture();
    await addResolvedSends(fx.listId, fx.campaignId, fx.stepId, 19, 1); // 1/20 = 5.0%, not > 5%

    await checkCircuitBreaker(fx.campaignId);

    const campaign = await prisma.campaign.findUnique({ where: { id: fx.campaignId } });
    expect(campaign?.status).toBe("running");
  });

  it("trips and pauses the campaign once the bounce rate exceeds 5% over 20+ resolved sends", async () => {
    const fx = await makeCampaignFixture();
    await addResolvedSends(fx.listId, fx.campaignId, fx.stepId, 17, 3); // 3/20 = 15%

    await checkCircuitBreaker(fx.campaignId);

    const campaign = await prisma.campaign.findUnique({ where: { id: fx.campaignId } });
    expect(campaign?.status).toBe("paused");
    expect(campaign?.pauseReason).toMatch(/bounce rate/i);
  });

  it("is a no-op for a campaign that isn't running (already paused/stopped/draft)", async () => {
    const fx = await makeCampaignFixture("paused");
    await addResolvedSends(fx.listId, fx.campaignId, fx.stepId, 0, 20); // 100% bounce, but not running

    await checkCircuitBreaker(fx.campaignId);

    const campaign = await prisma.campaign.findUnique({ where: { id: fx.campaignId } });
    expect(campaign?.status).toBe("paused"); // unchanged, still exactly the original pauseReason (null)
    expect(campaign?.pauseReason).toBeNull();
  });
});
