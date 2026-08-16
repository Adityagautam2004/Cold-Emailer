import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { PageHeader } from "@/components/ui/page-header";
import { EmailAccountManager } from "./email-account-manager";
import { DeleteAccountSection } from "./delete-account-section";

export default async function SettingsPage() {
  const user = await requireUser();

  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId: user.id },
    select: SAFE_EMAIL_ACCOUNT_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Connected mailbox</h2>
        <p className="mt-1 text-sm text-muted">
          Every campaign sends from this mailbox — never from a shared address.
        </p>
        <div className="mt-4">
          <EmailAccountManager initialAccounts={emailAccounts} />
        </div>
      </section>

      <DeleteAccountSection email={user.email} />
    </div>
  );
}
