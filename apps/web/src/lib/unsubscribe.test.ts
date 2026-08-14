import { randomUUID } from "node:crypto";
import { generateUnsubscribeToken } from "@dispatch/core/src/unsubscribe.js";
import { env } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { processUnsubscribeToken } from "./unsubscribe";

describe("§13/§2.5 — public unsubscribe token processing", () => {
  const stamp = Date.now();
  let userId: string;
  let email: string;

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `unsub-test-${stamp}-${randomUUID()}@example.com` } });
    userId = user.id;
    email = `unsub-${stamp}-${randomUUID()}@example.com`;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: `unsub-test-${stamp}` } }, select: { id: true } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  it("rejects a malformed token without writing anything", async () => {
    const result = await processUnsubscribeToken("not-a-real-token");
    expect(result.ok).toBe(false);
    const suppressions = await prisma.suppression.findMany({ where: { userId } });
    expect(suppressions).toHaveLength(0);
  });

  it("rejects a tampered token (valid shape, wrong signature)", async () => {
    const token = generateUnsubscribeToken({ userId, email }, env.UNSUBSCRIBE_SECRET);
    const tampered = token.slice(0, -2) + "xx";
    const result = await processUnsubscribeToken(tampered);
    expect(result.ok).toBe(false);
  });

  it("creates a Suppression row with reason 'unsubscribed' for a valid token", async () => {
    const token = generateUnsubscribeToken({ userId, email }, env.UNSUBSCRIBE_SECRET);
    const result = await processUnsubscribeToken(token);
    expect(result.ok).toBe(true);

    const suppression = await prisma.suppression.findUnique({ where: { userId_email: { userId, email } } });
    expect(suppression?.reason).toBe("unsubscribed");
  });

  it("marks every matching Contact row (across lists) as unsubscribed and cancels pending sends", async () => {
    const list = await prisma.contactList.create({ data: { userId, name: "L1", sourceFilename: "a.csv" } });
    const list2 = await prisma.contactList.create({ data: { userId, name: "L2", sourceFilename: "b.csv" } });
    const contact1 = await prisma.contact.create({ data: { listId: list.id, email, status: "sent", rowNumber: 1 } });
    const contact2 = await prisma.contact.create({ data: { listId: list2.id, email, status: "pending", rowNumber: 1 } });

    const resume = await prisma.resume.create({ data: { userId, storageKey: `${userId}/r.pdf`, filename: "r.pdf", sizeBytes: 10 } });
    const account = await prisma.emailAccount.create({
      data: { userId, fromEmail: `unsub-acct-${stamp}@gmail.com`, fromName: "T", credentialEnc: "v1.a.b.c", quotaResetAt: new Date() },
    });
    const template = await prisma.template.create({ data: { userId, name: "T", subject: "S {{company}}", bodyText: "B {{hr_name}}" } });
    const campaign = await prisma.campaign.create({
      data: { userId, listId: list.id, resumeId: resume.id, emailAccountId: account.id, name: "C", status: "running" },
    });
    const step = await prisma.campaignStep.create({ data: { campaignId: campaign.id, templateId: template.id, stepOrder: 0 } });
    const queuedSend = await prisma.send.create({
      data: { campaignId: campaign.id, contactId: contact2.id, stepId: step.id, scheduledAt: new Date(), status: "queued" },
    });

    const token = generateUnsubscribeToken({ userId, email }, env.UNSUBSCRIBE_SECRET);
    const result = await processUnsubscribeToken(token);
    expect(result.ok).toBe(true);

    const after1 = await prisma.contact.findUnique({ where: { id: contact1.id } });
    const after2 = await prisma.contact.findUnique({ where: { id: contact2.id } });
    expect(after1?.status).toBe("unsubscribed");
    expect(after2?.status).toBe("unsubscribed");

    const afterSend = await prisma.send.findUnique({ where: { id: queuedSend.id } });
    expect(afterSend?.status).toBe("cancelled");

    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it("is idempotent — a second visit to the same link does not error or duplicate the Suppression row", async () => {
    const token = generateUnsubscribeToken({ userId, email }, env.UNSUBSCRIBE_SECRET);
    await processUnsubscribeToken(token);
    const second = await processUnsubscribeToken(token);
    expect(second.ok).toBe(true);

    const suppressions = await prisma.suppression.findMany({ where: { userId, email } });
    expect(suppressions).toHaveLength(1);
  });
});
