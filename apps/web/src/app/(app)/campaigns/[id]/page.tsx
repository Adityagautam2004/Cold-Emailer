import { redirect } from "next/navigation";
import { NotFoundError } from "@/lib/api-errors";
import { getCampaignStats, getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { CampaignControls } from "./campaign-controls";
import { DispatchStripSection } from "./dispatch-strip-section";
import { SendLog } from "./send-log";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let campaign;
  try {
    campaign = await getOwnedCampaign(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) redirect("/campaigns");
    throw err;
  }

  const stats = await getCampaignStats(campaign.id, campaign.listId);

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.status} · ${campaign.perDayCap}/day · ${campaign.windowStart}–${campaign.windowEnd}`}
        backHref="/campaigns"
        backLabel="Back to campaigns"
        actions={<CampaignControls campaignId={campaign.id} status={campaign.status} />}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="Queued" value={stats.queued} tone="pending" />
        <StatTile label="Sent" value={stats.sent} />
        <StatTile label="Replied" value={stats.replied} tone="good" />
        <StatTile label="Bounced / failed" value={stats.bouncedOrFailed} tone="bad" className="col-span-2 sm:col-span-1" />
      </dl>

      {campaign.status === "paused" && campaign.pauseReason && (
        <div className="mt-6 rounded-md border border-pending/40 bg-pending-soft px-4 py-3 text-sm text-pending">
          Paused: {campaign.pauseReason}
        </div>
      )}

      <div className="mt-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Dispatch strip</p>
        <div className="rounded-lg border border-line bg-surface p-4">
          <DispatchStripSection campaignId={campaign.id} windowStart={campaign.windowStart} windowEnd={campaign.windowEnd} timezone={campaign.timezone} />
        </div>
      </div>

      <div className="mt-8">
        <SendLog campaignId={campaign.id} />
      </div>
    </div>
  );
}
