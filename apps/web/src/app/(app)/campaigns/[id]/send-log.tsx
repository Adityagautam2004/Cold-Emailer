"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

interface SendRow {
  id: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  lastError: string | null;
  contact: { email: string; hrName: string | null; company: string | null };
  step: { stepOrder: number };
}

export function SendLog({ campaignId }: { campaignId: string }) {
  const [sends, setSends] = useState<SendRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 100;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/campaigns/${campaignId}/sends?limit=${limit}&offset=0`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setSends(body.sends);
        setOffset(body.sends.length);
        setHasMore(body.sends.length === limit);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sends?limit=${limit}&offset=${offset}`);
      const body = await res.json();
      setSends((prev) => [...prev, ...body.sends]);
      setOffset((prev) => prev + body.sends.length);
      setHasMore(body.sends.length === limit);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Send log</h2>
      {loading ? (
        <TableSkeleton cols={5} />
      ) : sends.length === 0 ? (
        <EmptyState title="No sends scheduled yet" />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Scheduled</TableHeaderCell>
                <TableHeaderCell>Contact</TableHeaderCell>
                <TableHeaderCell>Step</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Error</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sends.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                    {new Date(s.scheduledAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.contact.email}</TableCell>
                  <TableCell className="font-mono text-xs text-muted">{s.step.stepOrder + 1}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-bad">{s.lastError ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && (
            <Button variant="ghost" size="sm" loading={loadingMore} onClick={loadMore} className="mt-3">
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
