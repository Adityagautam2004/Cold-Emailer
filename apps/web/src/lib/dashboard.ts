import "server-only";
import { effectiveDailyCap, HARD_DAILY_CAP, justSteppedUp, warmupStage } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { getCampaignStats, type CampaignStats } from "./campaigns";

export interface DashboardAlert {
  kind: "account_error" | "paused_campaign" | "warmup_step_up";
  message: string;
  href?: string;
}

export interface ActiveCampaignSummary {
  id: string;
  name: string;
  status: string;
  stats: CampaignStats;
}

export interface DashboardData {
  sentToday: number;
  capToday: number;
  repliesThisWeek: number;
  activeCampaigns: ActiveCampaignSummary[];
  alerts: DashboardAlert[];
  onboardingComplete: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** §14 — dashboard aggregates. No denormalised counters anywhere (§17): everything here is computed live from EmailAccount/Campaign/Send/Event on every load. */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [accounts, repliesThisWeek, campaigns] = await Promise.all([
    prisma.emailAccount.findMany({ where: { userId } }),
    prisma.event.count({ where: { userId, type: "replied", occurredAt: { gte: new Date(Date.now() - WEEK_MS) } } }),
    prisma.campaign.findMany({ where: { userId, status: { in: ["running", "paused"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const sentToday = activeAccounts.reduce((sum, a) => sum + a.sentToday, 0);
  // The account's own ceiling, not any one campaign's chosen (possibly tighter) per-day cap.
  const capToday = activeAccounts.reduce(
    (sum, a) => sum + effectiveDailyCap({ warmupStartedAt: a.warmupStartedAt, campaignPerDayCap: HARD_DAILY_CAP }),
    0
  );

  const activeCampaigns = await Promise.all(
    campaigns.map(async (c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      stats: await getCampaignStats(c.id, c.listId),
    }))
  );

  const alerts: DashboardAlert[] = [];
  for (const a of accounts) {
    if (a.status === "error") {
      alerts.push({
        kind: "account_error",
        message: `${a.fromEmail}: ${a.statusReason ?? "This mailbox needs attention."}`,
        href: "/settings",
      });
    }
    if (justSteppedUp(a.warmupStartedAt)) {
      const stage = warmupStage(a.warmupStartedAt);
      alerts.push({
        kind: "warmup_step_up",
        message: `${a.fromEmail} just stepped up to warmup stage ${stage.stage} — now sending up to ${stage.cap}/day.`,
      });
    }
  }
  for (const c of campaigns) {
    // "paused by user" (campaign-controls.tsx's manual pause) is a deliberate, already-known
    // action — not something to alert on. Anything else (circuit breaker, account error
    // cascade) is genuinely unexpected and worth surfacing.
    if (c.status === "paused" && c.pauseReason && c.pauseReason !== "paused by user") {
      alerts.push({ kind: "paused_campaign", message: `"${c.name}" was paused: ${c.pauseReason}`, href: `/campaigns/${c.id}` });
    }
  }

  return {
    sentToday,
    capToday,
    repliesThisWeek,
    activeCampaigns,
    alerts,
    onboardingComplete: accounts.some((a) => a.verifiedAt),
  };
}
