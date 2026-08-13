import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { computeSlots, isWithinSendWindow, nextEligibleWindowStart } from "./schedule.js";

function mulberry32(seed: number): () => number {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDow(date: Date, tz: string): number {
  const t = new TZDate(date, tz);
  const js = t.getDay();
  return js === 0 ? 7 : js;
}

function localHM(date: Date, tz: string): [number, number] {
  const t = new TZDate(date, tz);
  return [t.getHours(), t.getMinutes()];
}

function localDayKey(date: Date, tz: string): string {
  const t = new TZDate(date, tz);
  return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
}

const BASE_INPUT = {
  perDayCap: 20,
  minGapMinutes: 6,
  windowStart: "10:00",
  windowEnd: "18:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  timezone: "Asia/Kolkata",
};

describe("computeSlots — 300 contacts / 20 per day", () => {
  // Monday 09:00 IST — before the window opens, so every day gets a full window.
  const startFrom = new Date("2026-03-02T03:30:00Z");

  function run() {
    return computeSlots({ ...BASE_INPUT, count: 300, startFrom, rng: mulberry32(42) });
  }

  it("produces exactly one slot per contact", () => {
    expect(run()).toHaveLength(300);
  });

  it("spans exactly 15 distinct local days", () => {
    const days = new Set(run().map((d) => localDayKey(d, BASE_INPUT.timezone)));
    expect(days.size).toBe(15);
  });

  it("never schedules on a Saturday or Sunday", () => {
    for (const slot of run()) {
      const dow = isoDow(slot, BASE_INPUT.timezone);
      expect(dow).toBeGreaterThanOrEqual(1);
      expect(dow).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every slot inside the 10:00–18:00 local window", () => {
    for (const slot of run()) {
      const [h, m] = localHM(slot, BASE_INPUT.timezone);
      const minutesOfDay = h * 60 + m;
      expect(minutesOfDay).toBeGreaterThanOrEqual(10 * 60);
      expect(minutesOfDay).toBeLessThanOrEqual(18 * 60);
    }
  });

  it("never places two same-day slots closer than minGapMinutes", () => {
    const slots = run();
    const byDay = new Map<string, Date[]>();
    for (const s of slots) {
      const key = localDayKey(s, BASE_INPUT.timezone);
      byDay.set(key, [...(byDay.get(key) ?? []), s]);
    }
    for (const daySlots of byDay.values()) {
      const sorted = [...daySlots].sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gapMinutes = (sorted[i].getTime() - sorted[i - 1].getTime()) / 60_000;
        expect(gapMinutes).toBeGreaterThanOrEqual(BASE_INPUT.minGapMinutes - 1e-9);
      }
    }
  });

  it("is deterministic given a seeded rng", () => {
    const a = computeSlots({ ...BASE_INPUT, count: 300, startFrom, rng: mulberry32(7) });
    const b = computeSlots({ ...BASE_INPUT, count: 300, startFrom, rng: mulberry32(7) });
    expect(a.map((d) => d.getTime())).toEqual(b.map((d) => d.getTime()));
  });

  it("varies gaps instead of producing a perfectly even fingerprint", () => {
    const slots = run();
    const firstDayKey = localDayKey(slots[0], BASE_INPUT.timezone);
    const firstDay = slots.filter((s) => localDayKey(s, BASE_INPUT.timezone) === firstDayKey);
    const gaps = firstDay.slice(1).map((s, i) => s.getTime() - firstDay[i].getTime());
    const distinct = new Set(gaps.map((g) => Math.round(g / 1000)));
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("computeSlots — window edges", () => {
  it("starts from `startFrom` when the first day is already partway through the window", () => {
    // Monday 14:00 IST — mid-window.
    const startFrom = new Date("2026-03-02T08:30:00Z");
    const slots = computeSlots({ ...BASE_INPUT, count: 1, startFrom });
    expect(slots[0].getTime()).toBe(startFrom.getTime());
  });

  it("rolls to the next eligible day when startFrom is after today's window", () => {
    // Monday 19:00 IST — after the window closes.
    const startFrom = new Date("2026-03-02T13:30:00Z");
    const slots = computeSlots({ ...BASE_INPUT, count: 1, startFrom });
    const [h] = localHM(slots[0], BASE_INPUT.timezone);
    expect(h).toBe(10);
    expect(localDayKey(slots[0], BASE_INPUT.timezone)).not.toBe(localDayKey(startFrom, BASE_INPUT.timezone));
  });

  it("skips a weekend start day entirely", () => {
    // Saturday 12:00 IST.
    const startFrom = new Date("2026-03-07T06:30:00Z");
    const slots = computeSlots({ ...BASE_INPUT, count: 1, startFrom });
    expect(isoDow(slots[0], BASE_INPUT.timezone)).toBe(1); // the following Monday
  });

  it("caps items on a partial first day so gaps still hold, rolling the rest to tomorrow", () => {
    // Monday 17:55 IST — 5 minutes left in an 8-hour window, asking for 10 items at a 6-minute gap.
    const startFrom = new Date("2026-03-02T12:25:00Z");
    const slots = computeSlots({ ...BASE_INPUT, count: 10, startFrom });
    const firstDayKey = localDayKey(startFrom, BASE_INPUT.timezone);
    const today = slots.filter((s) => localDayKey(s, BASE_INPUT.timezone) === firstDayKey);
    expect(today.length).toBeLessThan(10);
    const tomorrow = slots.filter((s) => localDayKey(s, BASE_INPUT.timezone) !== firstDayKey);
    expect(today.length + tomorrow.length).toBe(10);
  });
});

describe("computeSlots — DST", () => {
  it("keeps the local wall-clock time fixed across a US spring-forward transition", () => {
    const tz = "America/New_York";
    const startFrom = new Date("2026-02-20T00:00:00Z");
    const slots = computeSlots({
      count: 40,
      startFrom,
      perDayCap: 1,
      minGapMinutes: 1,
      windowStart: "10:00",
      windowEnd: "18:00",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      timezone: tz,
    });

    // With one slot/day and no jitter (perDayCap 1), every slot lands exactly on window start.
    for (const s of slots) {
      const t = new TZDate(s, tz);
      expect(t.getHours()).toBe(10);
      expect(t.getMinutes()).toBe(0);
    }

    const utcHours = slots.map((s) => s.getUTCHours());
    const distinctOffsetHours = new Set(utcHours);
    // EST (UTC-5) gives 15:00 UTC for 10:00 local; EDT (UTC-4) gives 14:00 UTC. Both must appear.
    expect(distinctOffsetHours).toEqual(new Set([14, 15]));

    // Exactly one transition, from 15 to 14, moving forward in time — no flapping.
    let transitions = 0;
    for (let i = 1; i < utcHours.length; i++) {
      if (utcHours[i] !== utcHours[i - 1]) transitions++;
    }
    expect(transitions).toBe(1);
    expect(utcHours[0]).toBe(15);
    expect(utcHours[utcHours.length - 1]).toBe(14);
  });
});

describe("isWithinSendWindow / nextEligibleWindowStart", () => {
  const win = { ...BASE_INPUT };

  it("recognises inside vs outside the window", () => {
    expect(isWithinSendWindow(new Date("2026-03-02T06:30:00Z"), win)).toBe(true); // 12:00 IST Mon
    expect(isWithinSendWindow(new Date("2026-03-02T13:30:00Z"), win)).toBe(false); // 19:00 IST Mon
    expect(isWithinSendWindow(new Date("2026-03-07T06:30:00Z"), win)).toBe(false); // Saturday
  });

  it("finds the next eligible window start, always strictly on a later day", () => {
    // Monday 17:59 IST, picked up at 18:04 — must push to tomorrow per §10.2.
    const late = new Date("2026-03-02T12:29:00Z");
    const next = nextEligibleWindowStart(late, win);
    expect(localDayKey(next, win.timezone)).not.toBe(localDayKey(late, win.timezone));
    const [h, m] = localHM(next, win.timezone);
    expect(h).toBe(10);
    expect(m).toBe(0);
  });

  it("skips weekends when finding the next window", () => {
    // Friday evening -> next window should be Monday, not Saturday.
    const friday = new Date("2026-03-06T13:00:00Z");
    const next = nextEligibleWindowStart(friday, win);
    expect(isoDow(next, win.timezone)).toBe(1);
  });
});
