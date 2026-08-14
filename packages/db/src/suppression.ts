import { prisma } from "./index.js";

export type CascadeReason = "replied" | "bounced" | "unsubscribed";

export interface SuppressCascadeResult {
  contactIds: string[];
}

/**
 * Shared by three independent triggers — a reply (§13.3), a bounce (§13.4), and the public
 * unsubscribe link (§2.5) — because all three mean the same thing operationally: this
 * person, wherever they appear across this user's uploaded lists, should never be sent to
 * again, and anything already queued for them should stop. `reason` maps directly onto
 * `Contact.status` (replied|bounced|unsubscribed), so the cascade is identical either way;
 * only the `Suppression.reason` value recorded differs. Idempotent — suppressing an
 * already-suppressed address just no-ops the upsert.
 */
export async function suppressEmailCascade(
  userId: string,
  email: string,
  reason: CascadeReason,
  opts?: { token?: string }
): Promise<SuppressCascadeResult> {
  await prisma.suppression.upsert({
    where: { userId_email: { userId, email } },
    create: { userId, email, reason, token: opts?.token },
    update: {},
  });

  const contacts = await prisma.contact.findMany({
    where: { email, list: { userId } },
    select: { id: true },
  });
  const contactIds = contacts.map((c) => c.id);

  if (contactIds.length > 0) {
    await prisma.$transaction([
      prisma.contact.updateMany({ where: { id: { in: contactIds } }, data: { status: reason } }),
      prisma.send.updateMany({
        where: { contactId: { in: contactIds }, status: { in: ["queued", "claimed"] } },
        data: { status: "cancelled" },
      }),
    ]);
  }

  return { contactIds };
}
