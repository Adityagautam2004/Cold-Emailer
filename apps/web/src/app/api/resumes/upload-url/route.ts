import { randomUUID } from "node:crypto";
import { MAX_RESUME_SIZE_BYTES } from "@dispatch/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { resumeStorage } from "@/lib/storage";

const bodySchema = z.object({
  filename: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid upload request.", parsed.error.flatten());
  }

  const { filename, sizeBytes } = parsed.data;

  if (!/\.pdf$/i.test(filename)) {
    throw new ValidationError("Resumes must be a PDF file.");
  }
  if (sizeBytes > MAX_RESUME_SIZE_BYTES) {
    throw new ValidationError(
      `That file is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_RESUME_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  const resumeId = randomUUID();
  const key = resumeStorage.resumeKey(user.id, resumeId);
  const { signedUrl } = await resumeStorage.createUploadUrl(key);

  return NextResponse.json({ resumeId, uploadUrl: signedUrl });
});
