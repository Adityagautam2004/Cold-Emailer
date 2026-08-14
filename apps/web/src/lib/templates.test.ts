import { randomUUID } from "node:crypto";
import { prisma } from "@dispatch/db";
import { afterAll, describe, expect, it } from "vitest";
import { ensureSeedTemplates, getOwnedTemplate } from "./templates";
import { NotFoundError } from "./api-errors";

describe("§19 auth — templates ownership", () => {
  const stamp = Date.now();
  let userA: string;
  let userB: string;

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: `templates-test-${stamp}` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("getOwnedTemplate enforces ownership the same way as resumes/lists/email-accounts", async () => {
    const a = await prisma.user.create({ data: { email: `templates-test-${stamp}-a-${randomUUID()}@example.com` } });
    const b = await prisma.user.create({ data: { email: `templates-test-${stamp}-b-${randomUUID()}@example.com` } });
    userA = a.id;
    userB = b.id;
    const template = await prisma.template.create({ data: { userId: userA, name: "T", subject: "S", bodyText: "B" } });

    await expect(getOwnedTemplate(userA, template.id)).resolves.toMatchObject({ id: template.id });
    await expect(getOwnedTemplate(userB, template.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns 404 for a template id that doesn't exist at all", async () => {
    await expect(getOwnedTemplate(userA, "not-a-real-id")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ensureSeedTemplates gives each user their own independent set of 3, only once", async () => {
    const user = await prisma.user.create({ data: { email: `templates-test-${stamp}-seed-${randomUUID()}@example.com` } });
    await ensureSeedTemplates(user.id);
    const firstCount = await prisma.template.count({ where: { userId: user.id } });
    expect(firstCount).toBe(3);

    // Idempotent — calling it again (e.g. a second GET /api/templates) doesn't add more.
    await ensureSeedTemplates(user.id);
    const secondCount = await prisma.template.count({ where: { userId: user.id } });
    expect(secondCount).toBe(3);
  });
});
