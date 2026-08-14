import "server-only";
import { SEED_TEMPLATES } from "@dispatch/core";
import { prisma } from "@dispatch/db";
import { NotFoundError } from "./api-errors";

export async function getOwnedTemplate(userId: string, templateId: string) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || template.userId !== userId) {
    throw new NotFoundError("No template with that id.");
  }
  return template;
}

/** Every user gets the §12 starters once, the first time their template list is loaded. */
export async function ensureSeedTemplates(userId: string): Promise<void> {
  const count = await prisma.template.count({ where: { userId } });
  if (count > 0) return;

  await prisma.template.createMany({
    data: SEED_TEMPLATES.map((t) => ({
      userId,
      name: t.name,
      subject: t.subject,
      bodyText: t.bodyText,
    })),
  });
}
