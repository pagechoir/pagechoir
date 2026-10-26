import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { authConfig } from "./auth.config";
import { findUserByEmail, recordLogin } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || password.length < 8) return null;
        const user = await findUserByEmail(email);
        if (!user) return null;
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      const headerList = await headers();
      await recordLogin(user.id, headerList.get("user-agent") ?? "");
    },
  },
});
