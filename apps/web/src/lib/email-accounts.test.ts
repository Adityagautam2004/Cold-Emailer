import { prisma } from "@dispatch/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOwnedEmailAccount, getOwnedEmailAccountForSending, SAFE_EMAIL_ACCOUNT_SELECT } from "./email-accounts";

describe("§7 — credentialEnc never leaks", () => {
  it("SAFE_EMAIL_ACCOUNT_SELECT never includes credentialEnc", () => {
    expect(Object.keys(SAFE_EMAIL_ACCOUNT_SELECT)).not.toContain("credentialEnc");
  });

  describe("against a real row", () => {
    const stamp = Date.now();
    let user: { id: string };
    let accountId: string;

    beforeAll(async () => {
      user = await prisma.user.create({ data: { email: `email-accounts-test-${stamp}@example.com` } });
      const now = new Date();
      const account = await prisma.emailAccount.create({
        data: {
          userId: user.id,
          fromEmail: `test-${stamp}@gmail.com`,
          fromName: "Test Student",
          credentialEnc: "v1.fake.fake.fake",
          quotaResetAt: now,
          warmupStartedAt: now,
        },
      });
      accountId = account.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: user.id } });
    });

    it("getOwnedEmailAccount's returned object has no credentialEnc key", async () => {
      const account = await getOwnedEmailAccount(user.id, accountId);
      expect(Object.keys(account)).not.toContain("credentialEnc");
    });

    it("getOwnedEmailAccountForSending does include it — that's the one legitimate server-side use", async () => {
      const account = await getOwnedEmailAccountForSending(user.id, accountId);
      expect(account.credentialEnc).toBe("v1.fake.fake.fake");
    });
  });
});
