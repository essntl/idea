import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "./db";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { rateLimit, resetRateLimit } from "./rate-limit";
import { clientIp, hashIp } from "./request";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(500),
});

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword(randomUUID()));

export const LOGIN_LIMIT = { attempts: 10, windowSec: 15 * 60 };

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw, req) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ipKey = `login:${hashIp(clientIp(req?.headers ?? {}))}`;
        const limit = await rateLimit(ipKey, LOGIN_LIMIT.attempts, LOGIN_LIMIT.windowSec);
        if (!limit.ok) throw new Error("RateLimited");

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Always run a verification to keep timing similar for unknown emails.
        const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), parsed.data.password);
        if (!user || !ok) return null;
        await resetRateLimit(ipKey);
        return { id: user.id, email: user.email, name: user.name, sv: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sv = (user as { sv?: number }).sv ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.sv = token.sv as number;
      }
      return session;
    },
  },
};
