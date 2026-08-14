import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import type { Queue } from "bullmq";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { claimDueSends, processClaimedSend, sweepStuckClaims } from "./tick.js";

function hhmmUtc(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

const stamp = Date.now();
let userId: string;
let emailAccountId: string;
let campaignId: string;
let listId: string;
let stepId: string;

async function makeContact(email: string) {
  return prisma.contact.create({ data: { listId, email, rowNumber: 1 } });
}

async function makeSend(contactId: string, overrides: Partial<{ status: string; scheduledAt: Date; claimedAt: Date | null }> = {}) {
  return prisma.send.create({
    data: {
      campaignId,
      contactId,
      stepId,
      scheduledAt: overrides.scheduledAt ?? new Date(Date.now() - 60_000),
      status: overrides.status ?? "queued",
      claimedAt: overrides.claimedAt,
    },
  });
}

describe("worker tick mechanics (§10.2, §19)", () => {
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `tick-test-${stamp}-${randomUUID()}@example.com` } });
    userId = user.id;

    const account = await prisma.emailAccount.create({
      data: {
        userId,
        fromEmail: `tick-${randomUUID()}@gmail.com`,
        fromName: "Tick Test",
        credentialEnc: "v1.fake.fake.fake",
        warmupStartedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "active",
      },
    });
    emailAccountId = account.id;

    const resume = await prisma.resume.create({
      data: { userId, storageKey: `${userId}/fake.pdf`, filename: "fake.pdf", sizeBytes: 100 },
    });
    const list = await prisma.contactList.create({ data: { userId, name: "Tick fixture", sourceFilename: "x.csv" } });
    listId = list.id;
    const template = await prisma.template.create({
      data: { userId, name: "T", subject: "Hi {{company}}", bodyText: "Hi {{hr_name}}" },
    });
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        listId,
        resumeId: resume.id,
        emailAccountId,
        name: "Tick fixture campaign",
        status: "running",
        perDayCap: 50,
        windowStart: "00:00",
        windowEnd: "23:59",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      },
    });
    campaignId = campaign.id;
    const step = await prisma.campaignStep.create({ data: { campaignId, templateId: template.id, stepOrder: 0 } });
    stepId = step.id;
  });

  afterAll(async () => {
    // CampaignStep -> Template is deliberately onDelete: Restrict (§ Phase 3 — deleting a
    // template still in use by a campaign should fail with a friendly error, not silently
    // cascade away campaign history). That means a plain `user.deleteMany()` can hit that
    // same Restrict constraint via Template's own cascade path from User. Delete the
    // campaign side of the graph explicitly first.
    const users = await prisma.user.findMany({ where: { email: { contains: `tick-test-${stamp}` } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.campaign.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("claims each due send exactly once across two concurrent callers (SKIP LOCKED)", async () => {
    // claimDueSends() is intentionally global (the real tick claims across every user), so
    // this asserts against this test's own 10 rows specifically rather than the raw
    // combined claim count — the dev DB may have other due rows at the same instant.
    const contacts = await Promise.all(Array.from({ length: 10 }, (_, i) => makeContact(`concurrent-${i}-${stamp}@example.com`)));
    const mySends = await Promise.all(contacts.map((c) => makeSend(c.id)));
    const mySendIds = new Set(mySends.map((s) => s.id));

    const [claimA, claimB] = await Promise.all([claimDueSends(), claimDueSends()]);
    const myClaimedIds = [...claimA, ...claimB].map((r) => r.id).filter((id) => mySendIds.has(id));

    expect(myClaimedIds).toHaveLength(10); // every one of my rows was claimed by exactly one caller
    expect(new Set(myClaimedIds).size).toBe(10); // and none was claimed by both

    const stillQueued = await prisma.send.count({ where: { campaignId, status: "queued" } });
    expect(stillQueued).toBe(0);
  });

  it("does not claim a send scheduled in the future", async () => {
    // claimDueSends() is intentionally global — scope the assertion to this test's own row
    // rather than the raw claimed count, since another concurrently-running test file's
    // fixture can have a genuinely due row in the shared dev DB at the same instant.
    const contact = await makeContact(`future-${stamp}@example.com`);
    const futureSend = await makeSend(contact.id, { scheduledAt: new Date(Date.now() + 60 * 60 * 1000) });

    const claimed = await claimDueSends();
    expect(claimed.some((c) => c.id === futureSend.id)).toBe(false);
  });

  it("sweeps a send stuck in claimed for more than 10 minutes back to queued", async () => {
    const contact = await makeContact(`stuck-${stamp}@example.com`);
    const stuckSend = await makeSend(contact.id, { status: "claimed", claimedAt: new Date(Date.now() - 11 * 60 * 1000) });

    await sweepStuckClaims();

    const after = await prisma.send.findUnique({ where: { id: stuckSend.id } });
    expect(after?.status).toBe("queued");
    expect(after?.claimedAt).toBeNull();
  });

  it("does not touch a send claimed less than 10 minutes ago", async () => {
    const contact = await makeContact(`fresh-claim-${stamp}@example.com`);
    const recentSend = await makeSend(contact.id, { status: "claimed", claimedAt: new Date(Date.now() - 60_000) });

    await sweepStuckClaims();

    const after = await prisma.send.findUnique({ where: { id: recentSend.id } });
    expect(after?.status).toBe("claimed");
  });

  it("processes a send within the grace period even when now() has just slipped past windowEnd", async () => {
    // computeSlots deliberately clamps a day's last slot to exactly windowEnd (roughly half the
    // time, by construction). A byte-exact `isWithinSendWindow(now())` recheck would then bounce
    // that send to tomorrow the instant real processing delay pushes now() past windowEnd by even
    // a few ms. Regression test for that bug: windowEnd is set to 2 minutes ago, so the recheck's
    // raw isWithinSendWindow(now()) is false, but scheduledAt is also 2 minutes ago — well inside
    // the grace period — so the send must still be handed off, not requeued to a future day.
    const scheduledAt = new Date(Date.now() - 2 * 60_000);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { windowStart: "00:00", windowEnd: hhmmUtc(scheduledAt), daysOfWeek: [1, 2, 3, 4, 5, 6, 7], timezone: "UTC" },
    });
    const contact = await makeContact(`grace-${stamp}@example.com`);
    const send = await makeSend(contact.id, { status: "claimed", scheduledAt });

    const added: unknown[] = [];
    const fakeQueue = { add: async (...args: unknown[]) => added.push(args) } as unknown as Queue;

    await processClaimedSend(send.id, new Set(), fakeQueue);

    expect(added).toHaveLength(1); // handed off to the send queue, not bounced to tomorrow
    const after = await prisma.send.findUnique({ where: { id: send.id } });
    expect(after?.status).toBe("claimed"); // requeue() would have flipped this back to "queued"
    expect(after?.scheduledAt.getTime()).toBe(scheduledAt.getTime()); // untouched — not pushed to nextEligibleWindowStart
  });

  it("consumes quota and hands off to the send queue while sentToday is below the effective cap (§19)", async () => {
    await prisma.campaign.update({ where: { id: campaignId }, data: { perDayCap: 2 } });
    await prisma.emailAccount.update({ where: { id: emailAccountId }, data: { sentToday: 1 } }); // one below the cap

    const contact = await makeContact(`cap-ok-${stamp}@example.com`);
    const send = await makeSend(contact.id, { status: "claimed" });

    const added: unknown[] = [];
    const fakeQueue = { add: async (...args: unknown[]) => added.push(args) } as unknown as Queue;

    await processClaimedSend(send.id, new Set(), fakeQueue);

    expect(added).toHaveLength(1); // handed off — quota had room
    const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
    expect(account?.sentToday).toBe(2); // consumed atomically
  });

  it("refuses the cap+1th send — requeues without incrementing sentToday past the effective cap (§19)", async () => {
    await prisma.campaign.update({ where: { id: campaignId }, data: { perDayCap: 2 } });
    await prisma.emailAccount.update({ where: { id: emailAccountId }, data: { sentToday: 2 } }); // already at the cap

    const contact = await makeContact(`cap-refused-${stamp}@example.com`);
    const send = await makeSend(contact.id, { status: "claimed" });

    const added: unknown[] = [];
    const fakeQueue = { add: async (...args: unknown[]) => added.push(args) } as unknown as Queue;

    await processClaimedSend(send.id, new Set(), fakeQueue);

    expect(added).toHaveLength(0); // never handed off
    const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
    expect(account?.sentToday).toBe(2); // unchanged — never exceeds the cap

    const after = await prisma.send.findUnique({ where: { id: send.id } });
    expect(after?.status).toBe("queued"); // requeued, not left claimed or marked failed
    expect(after?.scheduledAt.getTime()).toBeGreaterThan(Date.now()); // pushed to a future eligible window
  });

  it("still defers a send that is genuinely stale (outside window and past the grace period)", async () => {
    const scheduledAt = new Date(Date.now() - 20 * 60_000); // 20 minutes ago — past the 5-minute grace
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { windowStart: "00:00", windowEnd: hhmmUtc(scheduledAt), daysOfWeek: [1, 2, 3, 4, 5, 6, 7], timezone: "UTC" },
    });
    const contact = await makeContact(`stale-${stamp}@example.com`);
    const send = await makeSend(contact.id, { status: "claimed", scheduledAt });

    const added: unknown[] = [];
    const fakeQueue = { add: async (...args: unknown[]) => added.push(args) } as unknown as Queue;

    await processClaimedSend(send.id, new Set(), fakeQueue);

    expect(added).toHaveLength(0); // not handed off to the send queue
    const after = await prisma.send.findUnique({ where: { id: send.id } });
    expect(after?.status).toBe("queued"); // requeued
    expect(after?.scheduledAt.getTime()).toBeGreaterThan(Date.now()); // pushed to a future eligible window
  });
});
