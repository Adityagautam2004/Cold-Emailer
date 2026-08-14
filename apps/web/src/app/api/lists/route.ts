import { MAX_IMPORT_ROWS } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { partitionAgainstUserHistory } from "@/lib/lists";
import { requireUser } from "@/lib/require-user";

export const GET = apiRoute(async () => {
  const user = await requireUser();
  const lists = await prisma.contactList.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, sourceFilename: true, rowCount: true, createdAt: true },
  });
  return NextResponse.json({ lists });
});

const candidateSchema = z.object({
  rowNumber: z.number().int(),
  email: z.string().email(),
  hrName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  custom: z.record(z.string()).optional(),
});

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  sourceFilename: z.string().min(1),
  candidates: z.array(candidateSchema).min(1).max(MAX_IMPORT_ROWS),
});

/**
 * Final commit step (§11 step 4) — only reached on explicit confirm. Applies the two
 * DB-backed exclusions the client-side preview couldn't (suppression, already-contacted),
 * then writes every remaining Contact row in one transaction.
 */
export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Import payload was malformed.", parsed.error.flatten());
  }
  const { name, sourceFilename, candidates } = parsed.data;

  const { suppressed, alreadyContacted } = await partitionAgainstUserHistory(
    user.id,
    candidates.map((c) => c.email)
  );

  const toImport = candidates.filter((c) => !suppressed.has(c.email) && !alreadyContacted.has(c.email));
  const excludedSuppressed = candidates.filter((c) => suppressed.has(c.email));
  const excludedAlreadyContacted = candidates.filter(
    (c) => alreadyContacted.has(c.email) && !suppressed.has(c.email)
  );

  const list = await prisma.$transaction(async (tx) => {
    const created = await tx.contactList.create({
      data: { userId: user.id, name, sourceFilename, rowCount: toImport.length },
    });
    if (toImport.length > 0) {
      await tx.contact.createMany({
        data: toImport.map((c) => ({
          listId: created.id,
          email: c.email,
          hrName: c.hrName ?? null,
          company: c.company ?? null,
          title: c.title ?? null,
          custom: c.custom ?? {},
          rowNumber: c.rowNumber,
        })),
      });
    }
    return created;
  });

  return NextResponse.json({
    list: { id: list.id, name: list.name, rowCount: list.rowCount },
    report: {
      imported: toImport.length,
      excludedSuppressed: excludedSuppressed.length,
      excludedAlreadyContacted: excludedAlreadyContacted.length,
      excludedRows: [
        ...excludedSuppressed.map((c) => ({ rowNumber: c.rowNumber, email: c.email, reason: "on your suppression list" })),
        ...excludedAlreadyContacted.map((c) => ({ rowNumber: c.rowNumber, email: c.email, reason: "already contacted in a previous list" })),
      ],
    },
  });
});
