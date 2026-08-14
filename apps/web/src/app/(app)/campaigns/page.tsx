import Link from "next/link";
import { prisma } from "@dispatch/db";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/require-user";

const STATUS_COLOR: Record<string, string> = {
  draft: "text-muted",
  running: "text-good",
  paused: "text-pending",
  stopped: "text-bad",
  completed: "text-good",
};

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true, rowCount: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
        >
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No campaigns yet. Pick a list, a resume, and a template to start one.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">List</th>
              <th className="py-2 pr-4">Pace</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-line">
                <td className="py-2.5 pr-4">
                  <Link href={`/campaigns/${c.id}`} className="text-accent hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-muted">
                  {c.list.name} ({c.list.rowCount})
                </td>
                <td className="py-2.5 pr-4 font-mono text-muted">
                  {c.perDayCap}/day, {c.windowStart}–{c.windowEnd}
                </td>
                <td className={cn("py-2.5 pr-4 font-mono", STATUS_COLOR[c.status] ?? "text-muted")}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
