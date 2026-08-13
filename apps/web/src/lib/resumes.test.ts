import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "./api-errors";
import { getOwnedResume } from "./resumes";

// Integration test against the real dev Postgres instance (see DECISIONS.md — no separate
// test DB is provisioned at this project's scale). Everything created here is cleaned up
// in afterAll via cascade delete on the users.
describe("getOwnedResume — ownership isolation (§19)", () => {
  const stamp = Date.now();
  let userA: { id: string };
  let userB: { id: string };
  let resumeId: string;

  beforeAll(async () => {
    userA = await prisma.user.create({ data: { email: `resumes-test-a-${stamp}@example.com` } });
    userB = await prisma.user.create({ data: { email: `resumes-test-b-${stamp}@example.com` } });
    const resume = await prisma.resume.create({
      data: {
        id: randomUUID(),
        userId: userA.id,
        storageKey: `${userA.id}/fake.pdf`,
        filename: "fake.pdf",
        sizeBytes: 1024,
      },
    });
    resumeId = resume.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it("returns the resume for its owner", async () => {
    const resume = await getOwnedResume(userA.id, resumeId);
    expect(resume.id).toBe(resumeId);
  });

  it("throws NotFoundError — not ForbiddenError — for a different user's resume, so existence can't be probed", async () => {
    await expect(getOwnedResume(userB.id, resumeId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for a genuinely nonexistent id, identically", async () => {
    await expect(getOwnedResume(userA.id, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});
