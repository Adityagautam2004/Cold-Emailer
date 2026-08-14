import { redirect } from "next/navigation";
import { NotFoundError } from "@/lib/api-errors";
import { getCampaignStats, getOwnedCampaign } from "@/lib/campaigns";
import { requireUser } from "@/lib/require-user";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{campaign.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted">
            {campaign.status} · {campaign.perDayCap}/day · {campaign.windowStart}–{campaign.windowEnd}
          </p>
        </div>
        <CampaignControls campaignId={campaign.id} status={campaign.status} />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Total</dt>
          <dd className="font-mono text-xl">{stats.total}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Queued</dt>
          <dd className="font-mono text-xl text-pending">{stats.queued}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Sent</dt>
          <dd className="font-mono text-xl">{stats.sent}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Replied</dt>
          <dd className="font-mono text-xl text-good">{stats.replied}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Bounced / failed</dt>
          <dd className="font-mono text-xl text-bad">{stats.bouncedOrFailed}</dd>
        </div>
      </dl>

      {campaign.status === "paused" && campaign.pauseReason && (
        <div className="mt-6 rounded-md border border-pending/40 bg-pending/10 px-4 py-3 text-sm text-pending">
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
