import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UnauthorizedError } from "@/lib/api-errors";
import { requireUser } from "@/lib/require-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects unauthenticated requests to /login for every path this
  // layout covers — this catch is only a safety net for a session that expired between
  // the middleware check and this render, so it degrades to the same redirect rather than
  // an uncaught 500.
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    throw err;
  }

  if (!user.acceptedTosAt) {
    redirect("/accept-terms");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
