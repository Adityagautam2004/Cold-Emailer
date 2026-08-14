"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CampaignControls({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "pause" | "resume" | "stop") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update the campaign.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-bad">{error}</span>}
      {status === "running" && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("pause")}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-standard hover:bg-surface disabled:opacity-50"
          >
            Pause
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("stop")}
            className="rounded-md border border-bad/40 px-3 py-1.5 text-sm font-medium text-bad transition-standard hover:bg-bad/10 disabled:opacity-50"
          >
            Stop
          </button>
        </>
      )}
      {status === "paused" && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("resume")}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
          >
            Resume
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("stop")}
            className="rounded-md border border-bad/40 px-3 py-1.5 text-sm font-medium text-bad transition-standard hover:bg-bad/10 disabled:opacity-50"
          >
            Stop
          </button>
        </>
      )}
    </div>
  );
}
