import { Prisma, prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { getOwnedList } from "@/lib/lists";
import { requireUser } from "@/lib/require-user";

export const DELETE = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await getOwnedList(user.id, id);

  try {
    await prisma.contactList.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new ValidationError("This list is used by a campaign — it can't be deleted.");
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
});
