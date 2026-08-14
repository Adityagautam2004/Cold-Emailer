import { validateTemplate } from "@dispatch/core";
import { Prisma } from "@dispatch/db";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, ValidationError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";
import { getOwnedTemplate } from "@/lib/templates";

export const GET = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const template = await getOwnedTemplate(user.id, id);
  return NextResponse.json({ template });
});

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(998),
  bodyText: z.string().min(1),
});

export const PATCH = apiRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await getOwnedTemplate(user.id, id);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Check the form and try again.", parsed.error.flatten());
  }

  const template = await prisma.template.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ template, warnings: validateTemplate(template.subject, template.bodyText) });
});

export const DELETE = apiRoute(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await getOwnedTemplate(user.id, id);

  try {
    await prisma.template.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new ValidationError("This template is used by a campaign — it can't be deleted.");
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
});
