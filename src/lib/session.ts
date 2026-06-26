import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { SessionUser, UserRole } from "./auth-utils";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role as UserRole,
    tenantId: session.user.tenantId ?? null,
    tenantName: session.user.tenantName ?? null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}
