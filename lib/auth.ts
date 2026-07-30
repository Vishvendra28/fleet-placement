import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hours
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;
          return { id: user.id, name: user.name, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
        } catch (e) {
          console.error("[auth] authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role: Role; tokenVersion: number };
        token.role = u.role;
        token.tokenVersion = u.tokenVersion;
        token.lastChecked = Math.floor(Date.now() / 1000);
        return token;
      }
      // Re-validate tokenVersion at most every 5 minutes
      const now = Math.floor(Date.now() / 1000);
      if (now - ((token.lastChecked as number) ?? 0) > 300) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub! },
            select: { tokenVersion: true, role: true },
          });
          if (!dbUser || dbUser.tokenVersion !== (token.tokenVersion as number)) {
            return { ...token, exp: 0 }; // force session expiry on next request
          }
          token.role = dbUser.role;
          token.lastChecked = now;
        } catch {
          // DB error — keep the current token rather than logging the user out
          token.lastChecked = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: Role }).id = token.sub!;
        (session.user as { id: string; role: Role }).role = token.role as Role;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
