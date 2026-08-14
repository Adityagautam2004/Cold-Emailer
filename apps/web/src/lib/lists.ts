import "server-only";
import { prisma } from "@dispatch/db";
import { NotFoundError } from "./api-errors";

export async function getOwnedList(userId: string, listId: string) {
  const list = await prisma.contactList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== userId) {
    throw new NotFoundError("No list with that id.");
  }
  return list;
}

/**
 * The two DB-backed exclusions §11 requires beyond what the pure `bucketRows` can check on
 * its own: the user's suppression list, and anyone already contacted in a prior list.
 * "Already contacted" is read off `Contact.status` — anything past `pending`/`skipped`
 * means some earlier campaign actually reached that address.
 */
export async function partitionAgainstUserHistory(
  userId: string,
  emails: string[]
): Promise<{ suppressed: Set<string>; alreadyContacted: Set<string> }> {
  if (emails.length === 0) return { suppressed: new Set(), alreadyContacted: new Set() };

  const [suppressions, priorContacts] = await Promise.all([
    prisma.suppression.findMany({
      where: { userId, email: { in: emails } },
      select: { email: true },
    }),
    prisma.contact.findMany({
      where: {
        email: { in: emails },
        status: { notIn: ["pending", "skipped"] },
        list: { userId },
      },
      select: { email: true },
    }),
  ]);

  return {
    suppressed: new Set(suppressions.map((s) => s.email)),
    alreadyContacted: new Set(priorContacts.map((c) => c.email)),
  };
}
