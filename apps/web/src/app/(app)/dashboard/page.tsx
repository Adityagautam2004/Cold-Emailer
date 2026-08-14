import Link from "next/link";
import { requireUser } from "@/lib/require-user";

// Full stats (sends today vs cap, replies this week, active campaigns, alerts) land in
// Phase 7 once campaigns and email accounts exist. This is the Phase 1 placeholder that
// gets a signed-in, ToS-accepted user somewhere real.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Welcome{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Sends-today, replies-this-week, and active-campaign stats show up here once you
        have a connected mailbox and a running campaign.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-medium">Get set up</h2>
        <p className="mt-2 text-sm text-muted">
          Profile, Gmail connection, resume, and the test email that verifies your mailbox
          — all four in one place.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
        >
          Continue setup
        </Link>
      </div>
    </div>
  );
}
