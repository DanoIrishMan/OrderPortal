import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { client: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          staffRole: user.staffRole,
          clientId: user.clientId,
          clientName: user.client?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.staffRole = user.staffRole;
        token.clientId = user.clientId;
        token.clientName = user.clientName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as "ADMIN" | "STAFF" | "CLIENT";
        session.user.staffRole = (token.staffRole as "ACCOUNT_MANAGER" | "DESIGNER" | null) ?? null;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.clientName = (token.clientName as string | null) ?? null;
      }
      return session;
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireStaff() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "STAFF") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

/** Legacy helper: single clientId for CLIENT users only. */
export function getClientFilter(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.user) return null;
  if (session.user.role === "ADMIN") return null;
  if (session.user.role === "CLIENT") return session.user.clientId;
  return null;
}

/** Order list access for admin, client portal, and account managers. */
export function buildOrderAccessWhere(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
): Prisma.OrderWhereInput {
  if (session.user.role === "ADMIN") return {};
  if (session.user.role === "CLIENT" && session.user.clientId) {
    return { clientId: session.user.clientId };
  }
  if (session.user.role === "STAFF" && session.user.staffRole === "ACCOUNT_MANAGER") {
    return { client: { accountManagerId: session.user.id } };
  }
  return { id: "__none__" };
}

export function canStaffViewOrders(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return session.user.role === "STAFF" && session.user.staffRole === "ACCOUNT_MANAGER";
}

export function isAccountManager(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return canStaffViewOrders(session);
}

export async function requireAdminOrAccountManager() {
  const session = await requireAuth();
  if (session.user.role === "ADMIN" || isAccountManager(session)) {
    return session;
  }
  throw new Error("Unauthorized");
}

export async function assertAccountManagerClientAccess(userId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountManagerId: userId, active: true },
    select: { id: true },
  });

  if (!client) {
    throw new Error("Forbidden");
  }

  return client;
}
