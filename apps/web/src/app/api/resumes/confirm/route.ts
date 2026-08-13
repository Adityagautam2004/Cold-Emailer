import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { resumeStorage } from "@/lib/storage";

const bodySchema = z.object({
  resumeId: z.string().uuid(),
  filename: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Called after the browser's direct PUT to the signed upload URL succeeds — creates the DB row only once the file is confirmed present, so a failed upload never leaves a row pointing at nothing. */
export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid confirm request.", parsed.error.flatten());
  }
  const { resumeId, filename, sizeBytes } = parsed.data;

  const key = resumeStorage.resumeKey(user.id, resumeId);
  const exists = await resumeStorage.exists(key);
  if (!exists) {
    throw new ValidationError("Upload didn't complete — try again.");
  }

  const maxVersion = await prisma.resume.aggregate({
    where: { userId: user.id },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  const resume = await prisma.$transaction(async (tx) => {
    await tx.resume.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } });
    return tx.resume.create({
      data: {
        id: resumeId,
        userId: user.id,
        storageKey: key,
        filename,
        sizeBytes,
        version: nextVersion,
        isActive: true,
      },
    });
  });

  return NextResponse.json({ resume });
});
