import { prisma } from "@dispatch/db";
import { redirect } from "next/navigation";
import { SAFE_EMAIL_ACCOUNT_SELECT } from "@/lib/email-accounts";
import { UnauthorizedError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    throw err;
  }
  if (!user.acceptedTosAt) redirect("/accept-terms");

  const [emailAccounts, resumes] = await Promise.all([
    prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: SAFE_EMAIL_ACCOUNT_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        version: true,
        isActive: true,
        isArchived: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-ink px-6 py-12 text-text">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Get set up</h1>
        <p className="mt-2 text-sm text-muted">Four steps. Come back any time — nothing here is lost.</p>

        <div className="mt-8">
          <OnboardingWizard
            profile={{ name: user.name, college: user.college, timezone: user.timezone }}
            emailAccounts={emailAccounts}
            resumes={resumes}
          />
        </div>
      </div>
    </main>
  );
}
