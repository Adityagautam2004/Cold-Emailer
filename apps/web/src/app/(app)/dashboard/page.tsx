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
        <ol className="mt-3 space-y-2 text-sm text-muted">
          <li>
            1. <Link href="/resumes" className="text-accent underline underline-offset-2">Upload your resume</Link>
          </li>
          <li>2. Connect your Gmail (Settings) — coming next</li>
          <li>3. Build a template and import a contact list</li>
          <li>4. Start a campaign</li>
        </ol>
      </div>
    </div>
  );
}
