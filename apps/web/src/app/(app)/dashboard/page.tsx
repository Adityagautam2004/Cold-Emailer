import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard";
import { requireUser } from "@/lib/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ALERT_STYLE: Record<string, string> = {
  account_error: "border-bad/40 bg-bad-soft text-bad",
  paused_campaign: "border-pending/40 bg-pending-soft text-pending",
  warmup_step_up: "border-good/40 bg-good-soft text-good",
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
      <PageHeader title={`Welcome${user.name ? `, ${user.name}` : ""}`} />

      {data.alerts.length > 0 && (
        <div className="mb-8 space-y-2">
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

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Sends today" value={<>{data.sentToday}<span className="text-muted"> / {data.capToday}</span></>} />
        <StatTile label="Replies this week" value={data.repliesThisWeek} tone="good" />
      </dl>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Active campaigns</p>
          <Link href="/campaigns/new" className="text-sm text-accent hover:underline">
            New campaign
          </Link>
        </div>

        {data.activeCampaigns.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon={Sparkles}
            title="No running campaigns yet"
            description="Pick a list, a resume, and a template to start one."
            action={<LinkButton href="/campaigns/new">Start a campaign</LinkButton>}
          />
        ) : (
          <div className="mt-3 space-y-3">
            {data.activeCampaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="group block">
                <Card className="p-4 transition-standard group-hover:border-accent/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="flex items-center gap-1">
                      <span className={cn("font-mono text-xs", STATUS_COLOR[c.status] ?? "text-muted")}>{c.status}</span>
                      <ArrowUpRight size={14} className="text-muted opacity-0 transition-standard group-hover:opacity-100" aria-hidden />
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
                    <span>{c.stats.total} total</span>
                    <span className="text-pending">{c.stats.queued} queued</span>
                    <span>{c.stats.sent} sent</span>
                    <span className="text-good">{c.stats.replied} replied</span>
                    {c.stats.bouncedOrFailed > 0 && <span className="text-bad">{c.stats.bouncedOrFailed} bounced/failed</span>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!data.onboardingComplete && (
        <Card className="mt-8 p-6">
          <h2 className="font-medium">Get set up</h2>
          <p className="mt-2 text-sm text-muted">
            Profile, Gmail connection, resume, and the test email that verifies your mailbox
            — all four in one place.
          </p>
          <LinkButton href="/onboarding" className="mt-4">
            Continue setup
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
