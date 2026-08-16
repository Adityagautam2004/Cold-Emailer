import { Send } from "lucide-react";
import Link from "next/link";
import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true, rowCount: true } } },
  });

  return (
    <div>
      <PageHeader title="Campaigns" actions={<LinkButton href="/campaigns/new">New campaign</LinkButton>} />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          description="Pick a list, a resume, and a template to start one."
          action={<LinkButton href="/campaigns/new">New campaign</LinkButton>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>List</TableHeaderCell>
              <TableHeaderCell>Pace</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id} className="transition-standard hover:bg-surface">
                <TableCell>
                  <Link href={`/campaigns/${c.id}`} className="font-medium text-accent hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted">
                  {c.list.name} ({c.list.rowCount})
                </TableCell>
                <TableCell className="font-mono text-xs text-muted">
                  {c.perDayCap}/day, {c.windowStart}–{c.windowEnd}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
