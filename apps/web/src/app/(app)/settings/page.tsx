import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { EmailAccountManager } from "./email-account-manager";

export default async function SettingsPage() {
  const user = await requireUser();

  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId: user.id },
    select: SAFE_EMAIL_ACCOUNT_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Settings</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Connected mailbox</h2>
        <p className="mt-1 text-sm text-muted">
          Every campaign sends from this mailbox — never from a shared address.
        </p>
        <div className="mt-4">
          <EmailAccountManager initialAccounts={emailAccounts} />
        </div>
      </section>
    </div>
  );
}
