import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

export const GET = apiRoute(async () => {
  const user = await requireUser();

  const resumes = await prisma.resume.findMany({
    where: { userId: user.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      version: true,
      isActive: true,
      isArchived: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ resumes });
});
