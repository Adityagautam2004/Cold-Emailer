"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SendRow {
  id: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  lastError: string | null;
  contact: { email: string; hrName: string | null; company: string | null };
  step: { stepOrder: number };
}

const STATUS_COLOR: Record<string, string> = {
  queued: "text-pending",
  claimed: "text-pending",
  sending: "text-pending",
  sent: "text-good",
  replied: "text-good",
  failed: "text-bad",
  cancelled: "text-muted",
  skipped: "text-muted",
};

export function SendLog({ campaignId }: { campaignId: string }) {
  const [sends, setSends] = useState<SendRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
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
    const res = await fetch(`/api/campaigns/${campaignId}/sends?limit=${limit}&offset=${offset}`);
    const body = await res.json();
    setSends((prev) => [...prev, ...body.sends]);
    setOffset((prev) => prev + body.sends.length);
    setHasMore(body.sends.length === limit);
  }

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Send log</h2>
      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : sends.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No sends scheduled yet.</p>
      ) : (
        <>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4">Scheduled</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Step</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Error</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2 pr-4 font-mono text-xs text-muted">
                    {new Date(s.scheduledAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{s.contact.email}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{s.step.stepOrder + 1}</td>
                  <td className={cn("py-2 pr-4 font-mono text-xs", STATUS_COLOR[s.status] ?? "text-muted")}>
                    {s.status}
                  </td>
                  <td className="py-2 pr-4 text-xs text-bad">{s.lastError ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button type="button" onClick={loadMore} className="mt-3 text-sm text-accent hover:underline">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
