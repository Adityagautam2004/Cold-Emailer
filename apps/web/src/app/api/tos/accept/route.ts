import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

export const POST = apiRoute(async () => {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { acceptedTosAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
