import { prisma } from "@dispatch/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOwnedList, partitionAgainstUserHistory } from "./lists";
import { NotFoundError } from "./api-errors";

describe("§11 — suppression and already-contacted exclusions", () => {
  const stamp = Date.now();
  let userA: { id: string };
  let userB: { id: string };
  let listId: string;

  const suppressedEmail = `suppressed-${stamp}@example.com`;
  const alreadySentEmail = `already-sent-${stamp}@example.com`;
  const freshEmail = `fresh-${stamp}@example.com`;

  beforeAll(async () => {
    userA = await prisma.user.create({ data: { email: `lists-test-a-${stamp}@example.com` } });
    userB = await prisma.user.create({ data: { email: `lists-test-b-${stamp}@example.com` } });

    const list = await prisma.contactList.create({
      data: { userId: userA.id, name: "History fixture", sourceFilename: "x.csv", rowCount: 2 },
    });
    listId = list.id;

    await prisma.contact.create({
      data: { listId: list.id, email: alreadySentEmail, status: "sent", rowNumber: 1 },
    });
    // A pending contact for the same address should NOT count as "already contacted".
    await prisma.contact.create({
      data: { listId: list.id, email: freshEmail, status: "pending", rowNumber: 2 },
    });

    await prisma.suppression.create({
      data: { userId: userA.id, email: suppressedEmail, reason: "manual" },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it("partitions suppressed and already-contacted emails independently", async () => {
    const result = await partitionAgainstUserHistory(userA.id, [suppressedEmail, alreadySentEmail, freshEmail]);
    expect(result.suppressed.has(suppressedEmail)).toBe(true);
    expect(result.alreadyContacted.has(alreadySentEmail)).toBe(true);
    expect(result.alreadyContacted.has(freshEmail)).toBe(false);
    expect(result.suppressed.has(alreadySentEmail)).toBe(false);
  });

  it("scopes both checks to the requesting user only — user B's history is untouched by user A's", async () => {
    const result = await partitionAgainstUserHistory(userB.id, [suppressedEmail, alreadySentEmail, freshEmail]);
    expect(result.suppressed.size).toBe(0);
    expect(result.alreadyContacted.size).toBe(0);
  });

  it("getOwnedList enforces ownership the same way as resumes/templates/email-accounts", async () => {
    await expect(getOwnedList(userA.id, listId)).resolves.toMatchObject({ id: listId });
    await expect(getOwnedList(userB.id, listId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
