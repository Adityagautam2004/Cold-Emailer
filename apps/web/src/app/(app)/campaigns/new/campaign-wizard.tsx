"use client";

import { computeSlots, warmupStage } from "@dispatch/core";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DispatchStrip } from "@/components/dispatch-strip";
import { cn } from "@/lib/utils";

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

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent";

/** Parses a free-typed numeric field, clamped to [min, max] — falls back when empty/non-numeric
 * (e.g. mid-edit) rather than snapping back on every keystroke like a clamped `useState<number>` would. */
function toInt(raw: string, fallback: number, min: number, max = Infinity): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

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
  // Raw text the user is typing, for steps 1..n parallel to stepTemplateIds.slice(1) — clamped
  // to a real number only via toInt() below, not on every keystroke, so the field stays freely
  // editable (can be cleared and retyped) instead of snapping back to the minimum while empty.
  const [delayDaysInput, setDelayDaysInput] = useState<string[]>([]);
  const delayDays = delayDaysInput.map((v) => toInt(v, 3, 3));

  const [perDayCapInput, setPerDayCapInput] = useState("20");
  const perDayCap = toInt(perDayCapInput, 20, 1, 50);
  const [minGapMinutesInput, setMinGapMinutesInput] = useState("6");
  const minGapMinutes = toInt(minGapMinutesInput, 6, 1);
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
    setDelayDaysInput([...delayDaysInput, "3"]);
  }
  function removeFollowUp(index: number) {
    setStepTemplateIds(stepTemplateIds.filter((_, i) => i !== index));
    setDelayDaysInput(delayDaysInput.filter((_, i) => i !== index - 1));
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
      <p className="text-sm text-muted">
        You need at least one list, an active resume, a verified mailbox, and a template
        before you can build a campaign.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Campaign name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. SDE outreach — batch 1" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">List</label>
          <select value={listId} onChange={(e) => setListId(e.target.value)} className={inputClass}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.rowCount})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Resume</label>
          <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={inputClass}>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.filename} (v{r.version}
                {r.isActive ? ", active" : ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Send from</label>
          <select value={emailAccountId} onChange={(e) => setEmailAccountId(e.target.value)} className={inputClass}>
            {verifiedAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fromEmail}
              </option>
            ))}
          </select>
          {stage && (
            <p className="mt-1 text-xs text-muted">
              Warmup stage {stage.stage} of 4 — {stage.cap}/day max right now.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Initial template</label>
          <select
            value={stepTemplateIds[0]}
            onChange={(e) => setStepTemplateIds([e.target.value, ...stepTemplateIds.slice(1)])}
            className={inputClass}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {stepTemplateIds.slice(1).map((templateId, i) => (
          <div key={i} className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Follow-up {i + 1}</span>
              <button type="button" onClick={() => removeFollowUp(i + 1)} className="text-xs text-muted hover:text-bad">
                Remove
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={templateId}
                onChange={(e) => {
                  const next = [...stepTemplateIds];
                  next[i + 1] = e.target.value;
                  setStepTemplateIds(next);
                }}
                className={inputClass}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={delayDaysInput[i] ?? "3"}
                  onChange={(e) => {
                    if (!/^\d*$/.test(e.target.value)) return;
                    const next = [...delayDaysInput];
                    next[i] = e.target.value;
                    setDelayDaysInput(next);
                  }}
                  onBlur={() => {
                    const next = [...delayDaysInput];
                    next[i] = String(toInt(next[i] ?? "3", 3, 3));
                    setDelayDaysInput(next);
                  }}
                  className={inputClass}
                />
                <span className="whitespace-nowrap text-xs text-muted">days after</span>
              </div>
            </div>
          </div>
        ))}
        {stepTemplateIds.length < 3 && (
          <button type="button" onClick={addFollowUp} className="text-sm text-accent hover:underline">
            + Add a follow-up
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Per day</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={perDayCapInput}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) setPerDayCapInput(e.target.value);
              }}
              onBlur={() => setPerDayCapInput(String(toInt(perDayCapInput, 20, 1, 50)))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Min gap (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={minGapMinutesInput}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) setMinGapMinutesInput(e.target.value);
              }}
              onBlur={() => setMinGapMinutesInput(String(toInt(minGapMinutesInput, 6, 1)))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Window start</label>
            <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Window end</label>
            <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Days of week</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => toggleDay(d.iso)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 font-mono text-xs transition-standard",
                  daysOfWeek.includes(d.iso) ? "border-accent text-text" : "border-line text-muted"
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
        <div className="rounded-lg border border-line bg-surface p-5">
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
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={creating || !preview}
          onClick={handleStart}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Starting…" : "Start campaign"}
        </button>
      </div>
    </div>
  );
}
