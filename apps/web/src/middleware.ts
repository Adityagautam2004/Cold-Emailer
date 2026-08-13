import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Middleware runs on the Edge runtime — it must use the Edge-safe config, not the full one
// in `@/lib/auth` (which pulls in argon2 and the Prisma adapter). See auth.config.ts.
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/resumes",
  "/templates",
  "/lists",
  "/campaigns",
  "/settings",
  "/accept-terms",
];

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/resumes/:path*",
    "/templates/:path*",
    "/lists/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
    "/accept-terms",
  ],
};
