import { describe, expect, it } from "vitest";
import { effectiveDailyCap, HARD_DAILY_CAP, justSteppedUp, warmupCap, warmupStage } from "./quota.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const connectedAt = new Date("2026-01-01T00:00:00Z");

function daysLater(n: number): Date {
  return new Date(connectedAt.getTime() + n * DAY_MS + 60_000); // +1min past midnight boundary
}

describe("warmup cap table", () => {
  it.each([
    [0, 10],
    [2, 10],
    [3, 20],
    [5, 20],
    [6, 35],
    [8, 35],
    [9, 50],
    [30, 50],
  ])("day %i -> cap %i", (day, expectedCap) => {
    expect(warmupCap(connectedAt, daysLater(day))).toBe(expectedCap);
  });

  it("never exceeds the hard cap of 50", () => {
    expect(warmupCap(connectedAt, daysLater(1000))).toBe(HARD_DAILY_CAP);
  });

  it("reports a stage number and next step-up date mid-ramp", () => {
    const stage = warmupStage(connectedAt, daysLater(4));
    expect(stage.cap).toBe(20);
    expect(stage.stage).toBe(2);
    expect(stage.nextStepUpAt).not.toBeNull();
  });

  it("has no next step-up once at the ceiling", () => {
    const stage = warmupStage(connectedAt, daysLater(9));
    expect(stage.nextStepUpAt).toBeNull();
  });
});

describe("justSteppedUp (§14 dashboard alert)", () => {
  it.each([3, 6, 9])("is true exactly on stage-boundary day %i", (day) => {
    expect(justSteppedUp(connectedAt, daysLater(day))).toBe(true);
  });

  it.each([0, 1, 2, 4, 5, 7, 8, 10, 30])("is false on any other day, including day 0 (initial connect)", (day) => {
    expect(justSteppedUp(connectedAt, daysLater(day))).toBe(false);
  });
});

describe("effectiveDailyCap", () => {
  it("is the minimum of warmup cap, campaign cap, and the hard cap", () => {
    expect(effectiveDailyCap({ warmupStartedAt: connectedAt, campaignPerDayCap: 5, now: daysLater(9) })).toBe(5);
    expect(effectiveDailyCap({ warmupStartedAt: connectedAt, campaignPerDayCap: 999, now: daysLater(9) })).toBe(
      HARD_DAILY_CAP
    );
    expect(effectiveDailyCap({ warmupStartedAt: connectedAt, campaignPerDayCap: 999, now: daysLater(0) })).toBe(10);
  });
});
