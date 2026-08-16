import { env } from "@dispatch/config";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe subset of the auth config — used directly by middleware. Must never import
 * anything that needs a Node runtime (argon2, the Prisma adapter): middleware runs on the
 * Edge runtime by default, which can't load native addons or Node built-ins. The full
 * config in `auth.ts` extends this with the Credentials provider and the Prisma adapter,
 * and only ever runs in Node-runtime route handlers and server components.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
