import { TZDate } from "@date-fns/tz";

export const HARD_DAILY_CAP = 50;

export interface WarmupStage {
  /** Days since the account was connected, floored at 0. */
  daysSinceConnect: number;
  /** Max sends/day this stage allows. */
  cap: number;
  /** 1-indexed stage number, for display ("stage 2 of 4"). */
  stage: number;
  /** Calendar date (UTC midnight) this account moves to the next stage, or null if already at the ceiling. */
  nextStepUpAt: Date | null;
}

const WARMUP_TABLE: Array<{ minDay: number; maxDay: number | null; cap: number }> = [
  { minDay: 0, maxDay: 2, cap: 10 },
  { minDay: 3, maxDay: 5, cap: 20 },
  { minDay: 6, maxDay: 8, cap: 35 },
  { minDay: 9, maxDay: null, cap: HARD_DAILY_CAP },
];

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Pure function of warmupStartedAt and "now" — never user-editable. */
export function warmupStage(warmupStartedAt: Date, now: Date = new Date()): WarmupStage {
  const daysSinceConnect = daysBetween(warmupStartedAt, now);
  const idx = WARMUP_TABLE.findIndex(
    (row) => daysSinceConnect >= row.minDay && (row.maxDay === null || daysSinceConnect <= row.maxDay)
  );
  const row = WARMUP_TABLE[idx] ?? WARMUP_TABLE[WARMUP_TABLE.length - 1];
  const nextStepUpAt =
    row.maxDay === null
      ? null
      : new Date(warmupStartedAt.getTime() + (row.maxDay + 1) * 24 * 60 * 60 * 1000);

  return { daysSinceConnect, cap: row.cap, stage: idx + 1, nextStepUpAt };
}

export function warmupCap(warmupStartedAt: Date, now: Date = new Date()): number {
  return warmupStage(warmupStartedAt, now).cap;
}

// Every stage's minDay except the first (day 0, "just connected" — not a step-up).
const STEP_UP_DAYS = new Set(WARMUP_TABLE.slice(1).map((row) => row.minDay));

/**
 * True exactly on the calendar day an account's warmup cap increases — used for the
 * dashboard's "your account just stepped up" alert (§14). Deliberately stateless: rather
 * than persisting "the last stage we told the student about" and diffing against it, this
 * just checks whether `daysSinceConnect` lands exactly on one of the warmup table's
 * boundaries today. A dashboard load on any other day of that stage returns false.
 */
export function justSteppedUp(warmupStartedAt: Date, now: Date = new Date()): boolean {
  return STEP_UP_DAYS.has(daysBetween(warmupStartedAt, now));
}

/** min(warmup cap, campaign's own per-day cap, the absolute hard cap). */
export function effectiveDailyCap(input: {
  warmupStartedAt: Date;
  campaignPerDayCap: number;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  return Math.min(warmupCap(input.warmupStartedAt, now), input.campaignPerDayCap, HARD_DAILY_CAP);
}

/** Next local midnight for `timezone`, expressed as a UTC Date — used by the 15-minute reset job. */
export function nextLocalMidnight(timezone: string, now: Date = new Date()): Date {
  const local = new TZDate(now, timezone);
  const midnight = new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + 1,
    0,
    0,
    0,
    0,
    timezone
  );
  return new Date(midnight.getTime());
}
