import { guessColumnMapping, parseSpreadsheet } from "@dispatch/core";
import { NextResponse } from "next/server";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

/**
 * Parses the uploaded sheet and hands the full header+rows matrix back to the client.
 * Everything downstream (mapping, bucketing, the report, the rejects CSV) runs
 * client-side against this same data, using the identical pure functions from
 * packages/core — so what the user previews is exactly what `POST /api/lists` commits,
 * modulo the two DB-backed checks (suppression, already-contacted) that only the server
 * can do.
 */
export const POST = apiRoute(async (req: Request) => {
  await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("No file was uploaded.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const sheet = await parseSpreadsheet(buffer, file.name);
    const mapping = guessColumnMapping(sheet.headers);
    return NextResponse.json({ sheet, mapping, sourceFilename: file.name });
  } catch (err) {
    throw new ValidationError(err instanceof Error ? err.message : "Could not read that file.");
  }
});
