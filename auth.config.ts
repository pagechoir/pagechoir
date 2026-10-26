import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPublic =
        path === "/login" ||
        path.startsWith("/share") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/register") ||
        path.startsWith("/api/share");
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
