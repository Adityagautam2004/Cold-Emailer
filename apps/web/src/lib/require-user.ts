import { prisma } from "@dispatch/db";
import { auth } from "./auth";
import { UnauthorizedError } from "./api-errors";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  college: string | null;
  acceptedTosAt: Date | null;
}

/**
 * The one path every (app) route and every /api route that touches user data must go
 * through (§6). Throws UnauthorizedError (caught by `apiRoute` as a 401) rather than
 * returning null, so a route can never accidentally fall through and run unscoped.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, timezone: true, college: true, acceptedTosAt: true },
  });

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

/** Same as requireUser(), but also blocks until the ToS gate (§6) has been passed. */
export async function requireUserWithTos(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.acceptedTosAt) {
    throw new UnauthorizedError("Accept the terms to continue.");
  }
  return user;
}
