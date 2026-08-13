import "server-only";
import { prisma } from "@dispatch/db";
import { NotFoundError } from "./api-errors";

/**
 * Loads a resume and verifies it belongs to `userId`. A resume that exists but belongs to
 * someone else is reported as 404, not 403 — same as a genuinely missing id — so a probing
 * request can't distinguish "not yours" from "doesn't exist" (§19).
 */
export async function getOwnedResume(userId: string, resumeId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume || resume.userId !== userId) {
    throw new NotFoundError("No resume with that id.");
  }
  return resume;
}
