"use client";

import { computeSlots, warmupStage } from "@dispatch/core";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DispatchStrip } from "@/components/dispatch-strip";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";

interface ListRow {
  id: string;
  name: string;
  rowCount: number;
}
interface ResumeRow {
  id: string;
  filename: string;
  version: number;
  isActive: boolean;
}
interface EmailAccountRow {
  id: string;
  fromEmail: string;
  verifiedAt: string | Date | null;
  warmupStartedAt: string | Date;
}
interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
}

const DAY_LABELS = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];

export function CampaignWizard({
  lists,
  resumes,
  emailAccounts,
  templates,
  timezone,
}: {
  lists: ListRow[];
  resumes: ResumeRow[];
  emailAccounts: EmailAccountRow[];
  templates: TemplateRow[];
  timezone: string;
}) {
  const router = useRouter();
  const verifiedAccounts = emailAccounts.filter((a) => a.verifiedAt);

  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes.find((r) => r.isActive)?.id ?? resumes[0]?.id ?? "");
  const [emailAccountId, setEmailAccountId] = useState(verifiedAccounts[0]?.id ?? "");
  const [stepTemplateIds, setStepTemplateIds] = useState<string[]>([templates[0]?.id ?? ""]);
  const [delayDays, setDelayDays] = useState<number[]>([]); // for steps 1..n, parallel to stepTemplateIds.slice(1)

  const [perDayCap, setPerDayCap] = useState(20);
  const [minGapMinutes, setMinGapMinutes] = useState(6);
  const [windowStart, setWindowStart] = useState("10:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedList = lists.find((l) => l.id === listId);
  const selectedAccount = verifiedAccounts.find((a) => a.id === emailAccountId);
  const stage = selectedAccount ? warmupStage(new Date(selectedAccount.warmupStartedAt)) : null;

  function addFollowUp() {
    if (stepTemplateIds.length >= 3) return;
    setStepTemplateIds([...stepTemplateIds, templates[0]?.id ?? ""]);
    setDelayDays([...delayDays, 3]);
  }
  function removeFollowUp(index: number) {
    setStepTemplateIds(stepTemplateIds.filter((_, i) => i !== index));
    setDelayDays(delayDays.filter((_, i) => i !== index - 1));
  }
  function toggleDay(iso: number) {
    setDaysOfWeek((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()));
  }

  const preview = useMemo(() => {
    if (!selectedList || selectedList.rowCount === 0 || daysOfWeek.length === 0) return null;
    try {
      const slots = computeSlots({
        count: selectedList.rowCount,
        startFrom: new Date(),
        perDayCap,
        minGapMinutes,
        windowStart,
        windowEnd,
        daysOfWeek,
        timezone,
      });
      const byDay = new Map<string, number>();
      for (const s of slots) {
        const key = new Date(s).toLocaleDateString("en-CA", { timeZone: timezone });
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      return {
        total: slots.length,
        first: slots[0],
        last: slots[slots.length - 1],
        days: byDay.size,
        slots,
      };
    } catch {
      return null;
    }
  }, [selectedList, perDayCap, minGapMinutes, windowStart, windowEnd, daysOfWeek, timezone]);

  async function handleStart() {
    setError(null);
    setCreating(true);
    try {
      const steps = stepTemplateIds.map((templateId, i) => ({
        templateId,
        stepOrder: i,
        delayDays: i === 0 ? 0 : delayDays[i - 1] ?? 3,
      }));

      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `${selectedList?.name} campaign`,
          listId,
          resumeId,
          emailAccountId,
          steps,
          perDayCap,
          minGapMinutes,
          windowStart,
          windowEnd,
          daysOfWeek,
          timezone,
          attachResume: true,
        }),
      });
      const createBody = await createRes.json();
      if (!createRes.ok) throw new Error(createBody.error ?? "Could not create the campaign.");

      const startRes = await fetch(`/api/campaigns/${createBody.campaign.id}/start`, { method: "POST" });
      const startBody = await startRes.json();
      if (!startRes.ok) throw new Error(startBody.error ?? "Could not start the campaign.");

      router.push(`/campaigns/${createBody.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  if (lists.length === 0 || resumes.length === 0 || verifiedAccounts.length === 0 || templates.length === 0) {
    return (
      <div>
        <PageHeader title="New campaign" backHref="/campaigns" backLabel="Back to campaigns" />
        <p className="text-sm text-muted">
          You need at least one list, an active resume, a verified mailbox, and a template
          before you can build a campaign.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New campaign" backHref="/campaigns" backLabel="Back to campaigns" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SDE outreach — batch 1" />
          </div>

          <div>
            <Label htmlFor="list">List</Label>
            <Select id="list" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.rowCount})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="resume">Resume</Label>
            <Select id="resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.filename} (v{r.version}
                  {r.isActive ? ", active" : ""})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="account">Send from</Label>
            <Select id="account" value={emailAccountId} onChange={(e) => setEmailAccountId(e.target.value)}>
              {verifiedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fromEmail}
                </option>
              ))}
            </Select>
            {stage && (
              <p className="mt-1.5 text-xs text-muted">
                Warmup stage {stage.stage} of 4 — {stage.cap}/day max right now.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="template">Initial template</Label>
            <Select
              id="template"
              value={stepTemplateIds[0]}
              onChange={(e) => setStepTemplateIds([e.target.value, ...stepTemplateIds.slice(1)])}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {stepTemplateIds.slice(1).map((templateId, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Follow-up {i + 1}</span>
                <button type="button" onClick={() => removeFollowUp(i + 1)} className="text-xs text-muted hover:text-bad">
                  Remove
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  value={templateId}
                  onChange={(e) => {
                    const next = [...stepTemplateIds];
                    next[i + 1] = e.target.value;
                    setStepTemplateIds(next);
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center gap-2">
                  <NumberField
                    min={3}
                    value={delayDays[i] ?? 3}
                    onChange={(next) => {
                      const nextArr = [...delayDays];
                      nextArr[i] = next;
                      setDelayDays(nextArr);
                    }}
                  />
                  <span className="whitespace-nowrap text-xs text-muted">days after</span>
                </div>
              </div>
            </Card>
          ))}
          {stepTemplateIds.length < 3 && (
            <button type="button" onClick={addFollowUp} className="text-sm text-accent hover:underline">
              + Add a follow-up
            </button>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="perDayCap">Per day</Label>
              <NumberField id="perDayCap" min={1} max={50} value={perDayCap} onChange={setPerDayCap} />
            </div>
            <div>
              <Label htmlFor="minGap">Min gap (minutes)</Label>
              <NumberField id="minGap" min={1} value={minGapMinutes} onChange={setMinGapMinutes} />
            </div>
            <div>
              <Label htmlFor="windowStart">Window start</Label>
              <Input id="windowStart" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="windowEnd">Window end</Label>
              <Input id="windowEnd" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Days of week</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleDay(d.iso)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 font-mono text-xs transition-standard",
                    daysOfWeek.includes(d.iso) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:bg-surface"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Review — before you commit</p>
          <Card className="p-5">
            {!preview ? (
              <p className="text-sm text-muted">Pick a list and a valid pace to see the schedule.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Total emails</dt>
                    <dd className="font-mono">{preview.total}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Days</dt>
                    <dd className="font-mono">{preview.days}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">First send</dt>
                    <dd className="font-mono">{new Date(preview.first).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Last send</dt>
                    <dd className="font-mono">{new Date(preview.last).toLocaleString()}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <DispatchStrip
                    ticks={preview.slots.map((s) => ({ date: s, status: "queued" as const }))}
                    windowStart={windowStart}
                    windowEnd={windowEnd}
                    timezone={timezone}
                  />
                </div>
              </>
            )}
          </Card>

          <FieldError>{error}</FieldError>

          <Button disabled={!preview} loading={creating} onClick={handleStart} className="mt-4">
            Start campaign
          </Button>
        </div>
      </div>
    </div>
  );
}
