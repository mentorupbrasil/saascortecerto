import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/lib/auth-utils";
import { prisma } from "./prisma";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const forwardedFor = req?.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
          ?.split(",")[0]
          ?.trim() || "unknown";

        await consumeRateLimit({
          scope: "login",
          identityParts: [ip, email],
          limit: 8,
          windowMs: 15 * 60 * 1000,
        }).catch((err) => {
          throw new Error(err instanceof Error ? err.message : RATE_LIMIT_MESSAGE);
        });

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: { select: { id: true, name: true, active: true } } },
        });

        if (!user || !user.active) return null;
        if (user.tenant && !user.tenant.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.lastDbSync = Date.now();
        return token;
      }

      // Revalidate role/active/tenant from DB periodically (not only at login)
      const lastSync = typeof token.lastDbSync === "number" ? token.lastDbSync : 0;
      const shouldSync = Date.now() - lastSync > 60_000; // every 60s
      if (shouldSync && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { tenant: { select: { id: true, name: true, active: true } } },
        });
        if (!dbUser || !dbUser.active || (dbUser.tenant && !dbUser.tenant.active)) {
          // Invalidate session claims — middleware/actions will reject
          token.active = false;
        } else {
          token.active = true;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.tenantName = dbUser.tenant?.name ?? null;
        }
        token.lastDbSync = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.active === false) {
          // Force empty session for deactivated users
          return { ...session, user: undefined as never };
        }
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.tenantId = (token.tenantId as string | null) ?? null;
        session.user.tenantName = (token.tenantName as string | null) ?? null;
      }
      return session;
    },
  },
};
