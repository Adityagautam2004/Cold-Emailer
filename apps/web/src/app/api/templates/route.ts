import { validateTemplate } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { ensureSeedTemplates } from "@/lib/templates";

export const GET = apiRoute(async () => {
  const user = await requireUser();
  await ensureSeedTemplates(user.id);

  const templates = await prisma.template.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ templates });
});

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(998), // RFC 5322 header line limit
  bodyText: z.string().min(1),
});

export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the form and try again.", parsed.error.flatten());
  }

  const template = await prisma.template.create({
    data: { userId: user.id, ...parsed.data },
  });

  return NextResponse.json({ template, warnings: validateTemplate(template.subject, template.bodyText) });
});
