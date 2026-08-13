import { prisma } from "@dispatch/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UnauthorizedError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

export default async function AcceptTermsPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    throw err;
  }

  if (user.acceptedTosAt) {
    redirect("/onboarding");
  }

  async function accept() {
    "use server";
    const current = await requireUser();
    await prisma.user.update({ where: { id: current.id }, data: { acceptedTosAt: new Date() } });
    redirect("/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-text">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">One thing before you start</h1>
        <p className="mt-3 text-sm text-muted">
          Dispatch sends email on your behalf, from your own mailbox. Before you connect an
          account, please read the terms:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/terms" className="text-accent underline underline-offset-2">
              Terms of service
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              Privacy policy
            </Link>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          In short: you are responsible for your own contact list, scraped or purchased
          lists are prohibited, and you can delete your account and data at any time from
          Settings.
        </p>
        <form action={accept} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-text transition-standard hover:opacity-90"
          >
            I agree — continue
          </button>
        </form>
      </div>
    </main>
  );
}
