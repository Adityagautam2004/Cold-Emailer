import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard";
import { requireUser } from "@/lib/require-user";

const ALERT_STYLE: Record<string, string> = {
  account_error: "border-bad/40 bg-bad/10 text-bad",
  paused_campaign: "border-pending/40 bg-pending/10 text-pending",
  warmup_step_up: "border-good/40 bg-good/10 text-good",
};

const STATUS_COLOR: Record<string, string> = {
  running: "text-good",
  paused: "text-pending",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Welcome{user.name ? `, ${user.name}` : ""}
      </h1>

      {data.alerts.length > 0 && (
        <div className="mt-6 space-y-2">
          {data.alerts.map((alert, i) => {
            const body = (
              <p className={cn("rounded-md border px-4 py-3 text-sm", ALERT_STYLE[alert.kind])}>{alert.message}</p>
            );
            return alert.href ? (
              <Link key={i} href={alert.href} className="block transition-standard hover:opacity-90">
                {body}
              </Link>
            ) : (
              <div key={i}>{body}</div>
            );
          })}
        </div>
      )}

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Sends today</dt>
          <dd className="font-mono text-xl">
            {data.sentToday}
            <span className="text-muted"> / {data.capToday}</span>
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Replies this week</dt>
          <dd className="font-mono text-xl text-good">{data.repliesThisWeek}</dd>
        </div>
      </dl>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Active campaigns</p>
          <Link href="/campaigns/new" className="text-sm text-accent hover:underline">
            New campaign
          </Link>
        </div>

        {data.activeCampaigns.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface p-6">
            <p className="text-sm text-muted">
              No running campaigns yet. Pick a list, a resume, and a template to start one.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
            >
              Start a campaign
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {data.activeCampaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block rounded-lg border border-line bg-surface p-4 transition-standard hover:border-accent/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className={cn("font-mono text-xs", STATUS_COLOR[c.status] ?? "text-muted")}>{c.status}</span>
                </div>
                <div className="mt-2 flex gap-4 font-mono text-xs text-muted">
                  <span>{c.stats.total} total</span>
                  <span className="text-pending">{c.stats.queued} queued</span>
                  <span>{c.stats.sent} sent</span>
                  <span className="text-good">{c.stats.replied} replied</span>
                  {c.stats.bouncedOrFailed > 0 && <span className="text-bad">{c.stats.bouncedOrFailed} bounced/failed</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!data.onboardingComplete && (
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
      )}
    </div>
  );
}
