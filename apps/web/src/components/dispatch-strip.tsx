"use client";

import { cn } from "@/lib/utils";

export type DispatchStripStatus = "queued" | "sent" | "replied" | "failed" | "cancelled";

export interface DispatchStripTick {
  date: Date | string;
  status: DispatchStripStatus;
}

interface DispatchStripProps {
  ticks: DispatchStripTick[];
  windowStart: string; // "HH:mm"
  windowEnd: string;
  timezone: string;
}

const STATUS_DOT: Record<DispatchStripStatus, string> = {
  queued: "bg-pending",
  sent: "bg-muted",
  replied: "bg-good",
  failed: "bg-bad",
  cancelled: "bg-muted/30",
};

const COLUMN_HEIGHT_PX = 160;
const MINUTES_PER_DAY = 1440;

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function dayKey(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * §15's "signature element" — a horizontal strip of days, each a thin column spanning a
 * full 24h, with the campaign's send window rendered as a lighter band against darker
 * off-hours. Each send is a tick positioned at its actual local time of day, coloured by
 * outcome. Used both on /campaigns/[id] (real Send data) and in the campaign builder's
 * review step (a computeSlots() preview, before anything really exists).
 */
export function DispatchStrip({ ticks, windowStart, windowEnd, timezone }: DispatchStripProps) {
  if (ticks.length === 0) {
    return <p className="text-sm text-muted">Nothing scheduled yet.</p>;
  }

  const windowStartMin = parseHM(windowStart);
  const windowEndMin = parseHM(windowEnd);

  const days = new Map<string, DispatchStripTick[]>();
  for (const tick of ticks) {
    const date = typeof tick.date === "string" ? new Date(tick.date) : tick.date;
    const key = dayKey(date, timezone);
    const bucket = days.get(key);
    if (bucket) bucket.push(tick);
    else days.set(key, [tick]);
  }
  const sortedDays = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5">
        {sortedDays.map(([key, dayTicks]) => (
          <div key={key} className="flex flex-col items-center gap-1.5">
            <div
              className="relative w-7 overflow-hidden rounded-sm bg-ink"
              style={{ height: COLUMN_HEIGHT_PX }}
              title={key}
            >
              <div
                className="absolute inset-x-0 bg-surface"
                style={{
                  top: `${(windowStartMin / MINUTES_PER_DAY) * 100}%`,
                  height: `${((windowEndMin - windowStartMin) / MINUTES_PER_DAY) * 100}%`,
                }}
              />
              {dayTicks.map((tick, i) => {
                const date = typeof tick.date === "string" ? new Date(tick.date) : tick.date;
                const minute = minutesOfDay(date, timezone);
                return (
                  <div
                    key={i}
                    className={cn("absolute inset-x-0.5 h-[3px] rounded-full", STATUS_DOT[tick.status])}
                    style={{ top: `${Math.min(99, (minute / MINUTES_PER_DAY) * 100)}%` }}
                    title={`${date.toLocaleString(undefined, { timeZone: timezone })} — ${tick.status}`}
                  />
                );
              })}
            </div>
            <span className="whitespace-nowrap font-mono text-[10px] text-muted">{key.slice(5)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend color="bg-pending" label="Queued" />
        <Legend color="bg-muted" label="Sent" />
        <Legend color="bg-good" label="Replied" />
        <Legend color="bg-bad" label="Failed" />
        <Legend color="bg-muted/30" label="Cancelled" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}
