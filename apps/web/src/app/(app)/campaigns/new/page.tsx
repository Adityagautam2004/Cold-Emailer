import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { CampaignWizard } from "./campaign-wizard";

export default async function NewCampaignPage() {
  const user = await requireUser();

  const [lists, resumes, emailAccounts, templates] = await Promise.all([
    prisma.contactList.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, rowCount: true },
    }),
    prisma.resume.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { version: "desc" },
      select: { id: true, filename: true, version: true, isActive: true },
    }),
    prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: SAFE_EMAIL_ACCOUNT_SELECT,
    }),
    prisma.template.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, subject: true, bodyText: true },
    }),
  ]);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">New campaign</h1>
      <div className="mt-8">
        <CampaignWizard
          lists={lists}
          resumes={resumes}
          emailAccounts={emailAccounts}
          templates={templates}
          timezone={user.timezone}
        />
      </div>
    </div>
  );
}
