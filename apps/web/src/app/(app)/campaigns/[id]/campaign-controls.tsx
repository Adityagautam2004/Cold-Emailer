"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

const ACTION_LABEL: Record<string, string> = {
  pause: "paused",
  resume: "resumed",
  stop: "stopped",
};

export function CampaignControls({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function act(action: "pause" | "resume" | "stop") {
    if (action === "stop") {
      const ok = await confirm({
        title: "Stop this campaign?",
        description: "Every queued send is cancelled. This can't be undone — you'd need to start a new campaign to reach the remaining contacts.",
        confirmLabel: "Stop campaign",
        destructive: true,
      });
      if (!ok) return;
    }

    setPending(action);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update the campaign.");
      toast.success(`Campaign ${ACTION_LABEL[action]}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {dialog}
      {status === "running" && (
        <>
          <Button variant="secondary" size="sm" loading={pending === "pause"} disabled={!!pending} onClick={() => act("pause")}>
            Pause
          </Button>
          <Button variant="destructive" size="sm" loading={pending === "stop"} disabled={!!pending} onClick={() => act("stop")}>
            Stop
          </Button>
        </>
      )}
      {status === "paused" && (
        <>
          <Button size="sm" loading={pending === "resume"} disabled={!!pending} onClick={() => act("resume")}>
            Resume
          </Button>
          <Button variant="destructive" size="sm" loading={pending === "stop"} disabled={!!pending} onClick={() => act("stop")}>
            Stop
          </Button>
        </>
      )}
    </div>
  );
}
