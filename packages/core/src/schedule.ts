import { TZDate } from "@date-fns/tz";

export interface ComputeSlotsInput {
  /** Contacts to schedule. */
  count: number;
  /** Usually now(). */
  startFrom: Date;
  perDayCap: number;
  minGapMinutes: number;
  /** "HH:mm" in `timezone`. */
  windowStart: string;
  windowEnd: string;
  /** ISO weekdays, 1=Mon .. 7=Sun. */
  daysOfWeek: number[];
  timezone: string;
  /** Default 0.4 — how much each interval can wobble around its base value. */
  jitterRatio?: number;
  /** Injectable for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
}

interface WindowInput {
  windowStart: string;
  windowEnd: string;
  daysOfWeek: number[];
  timezone: string;
}

function parseHM(s: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`invalid HH:mm string: "${s}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) throw new Error(`invalid HH:mm string: "${s}"`);
  return [h, min];
}

/** ISO weekday (1=Mon..7=Sun) of the given local calendar date in `tz`. Noon avoids any midnight DST-transition ambiguity. */
function isoDayOfWeek(y: number, mo: number, d: number, tz: string): number {
  const js = new TZDate(y, mo, d, 12, 0, 0, 0, tz).getDay();
  return js === 0 ? 7 : js;
}

function atLocalTime(y: number, mo: number, d: number, h: number, m: number, tz: string): TZDate {
  return new TZDate(y, mo, d, h, m, 0, 0, tz);
}

function localYMD(date: Date, tz: string): [number, number, number] {
  const t = new TZDate(date, tz);
  return [t.getFullYear(), t.getMonth(), t.getDate()];
}

/** Pure calendar-day arithmetic — UTC-anchored so it never touches wall-clock/DST math. */
function nextDay(y: number, mo: number, d: number): [number, number, number] {
  const t = new Date(Date.UTC(y, mo, d + 1));
  return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
}

/**
 * Distributes `count` items across eligible days starting from `startFrom`, jittered within
 * each day's send window. Self-corrects at every step by recomputing the interval from the
 * *remaining* time budget and *remaining* item count — so gaps never fall below
 * `minGapMinutes` and no slot ever crosses `windowEnd`, regardless of how the RNG rolls.
 */
export function computeSlots(input: ComputeSlotsInput): Date[] {
  const {
    count,
    startFrom,
    perDayCap,
    minGapMinutes,
    windowStart,
    windowEnd,
    daysOfWeek,
    timezone,
    jitterRatio = 0.4,
    rng = Math.random,
  } = input;

  if (count <= 0) return [];
  if (perDayCap <= 0) throw new Error("perDayCap must be > 0");
  if (minGapMinutes <= 0) throw new Error("minGapMinutes must be > 0");
  if (daysOfWeek.length === 0) throw new Error("daysOfWeek must not be empty");

  const daySet = new Set(daysOfWeek);
  const [wsH, wsM] = parseHM(windowStart);
  const [weH, weM] = parseHM(windowEnd);
  const minGapMs = minGapMinutes * 60_000;

  const slots: Date[] = [];
  let remaining = count;
  let [y, mo, d] = localYMD(startFrom, timezone);
  let firstDay = true;

  const MAX_DAYS = 5000; // safety valve against a misconfigured daysOfWeek (e.g. empty set slipping through)
  for (let daysWalked = 0; remaining > 0; daysWalked++) {
    if (daysWalked > MAX_DAYS) {
      throw new Error("computeSlots: exceeded maximum lookahead — check daysOfWeek/window configuration");
    }

    if (!daySet.has(isoDayOfWeek(y, mo, d, timezone))) {
      [y, mo, d] = nextDay(y, mo, d);
      firstDay = false;
      continue;
    }

    const dayStart = atLocalTime(y, mo, d, wsH, wsM, timezone);
    const dayEnd = atLocalTime(y, mo, d, weH, weM, timezone);

    let spanStartMs = dayStart.getTime();
    if (firstDay && startFrom.getTime() > spanStartMs) {
      spanStartMs = startFrom.getTime();
    }

    if (spanStartMs >= dayEnd.getTime()) {
      [y, mo, d] = nextDay(y, mo, d);
      firstDay = false;
      continue;
    }

    const spanMs = dayEnd.getTime() - spanStartMs;
    const maxFitToday = Math.floor(spanMs / minGapMs) + 1;
    const itemsToday = Math.max(0, Math.min(perDayCap, remaining, maxFitToday));

    if (itemsToday === 0) {
      [y, mo, d] = nextDay(y, mo, d);
      firstDay = false;
      continue;
    }

    let slotTime = spanStartMs;
    slots.push(new Date(slotTime));

    for (let i = 1; i < itemsToday; i++) {
      const itemsLeft = itemsToday - i; // includes the one about to be placed
      const remainingSpanMs = dayEnd.getTime() - slotTime;
      const baseInterval = Math.max(minGapMs, remainingSpanMs / itemsLeft);
      const jitterMul = 1 + jitterRatio * (rng() * 2 - 1);
      const itemsLeftAfterThis = itemsLeft - 1;
      const maxAllowed = Math.max(minGapMs, remainingSpanMs - itemsLeftAfterThis * minGapMs);
      const interval = Math.min(Math.max(minGapMs, baseInterval * jitterMul), maxAllowed);
      slotTime = Math.min(slotTime + interval, dayEnd.getTime());
      slots.push(new Date(slotTime));
    }

    remaining -= itemsToday;
    [y, mo, d] = nextDay(y, mo, d);
    firstDay = false;
  }

  return slots;
}

/** True if `date` falls on an eligible day and inside that day's local send window. */
export function isWithinSendWindow(date: Date, input: WindowInput): boolean {
  const [y, mo, d] = localYMD(date, input.timezone);
  if (!input.daysOfWeek.includes(isoDayOfWeek(y, mo, d, input.timezone))) return false;
  const [wsH, wsM] = parseHM(input.windowStart);
  const [weH, weM] = parseHM(input.windowEnd);
  const start = atLocalTime(y, mo, d, wsH, wsM, input.timezone).getTime();
  const end = atLocalTime(y, mo, d, weH, weM, input.timezone).getTime();
  const t = date.getTime();
  return t >= start && t <= end;
}

/** The window start of the next eligible day strictly after `after`'s local calendar day — used to push a late or quota-refused send forward. */
export function nextEligibleWindowStart(after: Date, input: WindowInput): Date {
  let [y, mo, d] = localYMD(after, input.timezone);
  [y, mo, d] = nextDay(y, mo, d);
  const [wsH, wsM] = parseHM(input.windowStart);

  for (let i = 0; i < 3660; i++) {
    if (input.daysOfWeek.includes(isoDayOfWeek(y, mo, d, input.timezone))) {
      return new Date(atLocalTime(y, mo, d, wsH, wsM, input.timezone).getTime());
    }
    [y, mo, d] = nextDay(y, mo, d);
  }
  throw new Error("nextEligibleWindowStart: no eligible day found within lookahead");
}
