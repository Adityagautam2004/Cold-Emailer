import { prisma } from "@dispatch/db";
import { DispatchStrip, type DispatchStripStatus, type DispatchStripTick } from "@/components/dispatch-strip";

/** Send.status has no "replied"/"bounced" value of its own (see getCampaignStats) — the tick's colour needs the linked Contact's current status too. */
function tickStatus(sendStatus: string, contactStatus: string): DispatchStripStatus {
  if (sendStatus === "sent") return contactStatus === "replied" ? "replied" : "sent";
  if (sendStatus === "failed") return "failed";
  if (sendStatus === "cancelled" || sendStatus === "skipped") return "cancelled";
  return "queued"; // queued | claimed | sending
}

export async function DispatchStripSection({
  campaignId,
  windowStart,
  windowEnd,
  timezone,
}: {
  campaignId: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
}) {
  const sends = await prisma.send.findMany({
    where: { campaignId },
    select: { scheduledAt: true, status: true, contact: { select: { status: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const ticks: DispatchStripTick[] = sends.map((s) => ({
    date: s.scheduledAt,
    status: tickStatus(s.status, s.contact.status),
  }));

  return <DispatchStrip ticks={ticks} windowStart={windowStart} windowEnd={windowEnd} timezone={timezone} />;
}
