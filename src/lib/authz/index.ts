import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type Permission =
  | "agenda:view_all"
  | "agenda:view_own"
  | "agenda:edit"
  | "agenda:cancel"
  | "clients:manage"
  | "services:manage"
  | "team:manage"
  | "settings:manage"
  | "integrations:manage"
  | "billing_saas:view"
  | "finance:view"
  | "finance:sell"
  | "finance:discount"
  | "finance:refund"
  | "finance:cash_close"
  | "finance:cash_reopen"
  | "inventory:view"
  | "inventory:adjust"
  | "reports:view"
  | "reports:export"
  | "club:manage"
  | "payment:confirm_manual"
  | "platform:tenants";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "platform:tenants",
    "agenda:view_all",
    "agenda:edit",
    "agenda:cancel",
    "clients:manage",
    "services:manage",
    "team:manage",
    "settings:manage",
    "integrations:manage",
    "billing_saas:view",
    "finance:view",
    "finance:sell",
    "finance:discount",
    "finance:refund",
    "finance:cash_close",
    "finance:cash_reopen",
    "inventory:view",
    "inventory:adjust",
    "reports:view",
    "reports:export",
    "club:manage",
    "payment:confirm_manual",
  ],
  OWNER: [
    "agenda:view_all",
    "agenda:edit",
    "agenda:cancel",
    "clients:manage",
    "services:manage",
    "team:manage",
    "settings:manage",
    "integrations:manage",
    "billing_saas:view",
    "finance:view",
    "finance:sell",
    "finance:discount",
    "finance:refund",
    "finance:cash_close",
    "finance:cash_reopen",
    "inventory:view",
    "inventory:adjust",
    "reports:view",
    "reports:export",
    "club:manage",
    "payment:confirm_manual",
  ],
  MANAGER: [
    "agenda:view_all",
    "agenda:edit",
    "agenda:cancel",
    "clients:manage",
    "services:manage",
    "settings:manage",
    "integrations:manage",
    "finance:view",
    "finance:sell",
    "finance:discount",
    "finance:refund",
    "finance:cash_close",
    "inventory:view",
    "inventory:adjust",
    "reports:view",
    "reports:export",
    "club:manage",
    "payment:confirm_manual",
  ],
  RECEPTIONIST: [
    "agenda:view_all",
    "agenda:edit",
    "clients:manage",
    "finance:sell",
    "inventory:view",
    "club:manage",
  ],
  BARBER: ["agenda:view_own", "agenda:edit", "finance:sell"],
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  tenantId: string | null;
  tenantName: string | null;
  tenantActive: boolean;
  permissions: Permission[];
};

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "INACTIVE" | "TENANT_REQUIRED";
  constructor(
    code: AuthError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AuthError("UNAUTHENTICATED", "Não autenticado");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      tenant: { select: { id: true, name: true, active: true } },
    },
  });

  if (!dbUser) {
    throw new AuthError("UNAUTHENTICATED", "Usuário não encontrado");
  }
  if (!dbUser.active) {
    throw new AuthError("INACTIVE", "Usuário desativado");
  }
  if (dbUser.tenant && !dbUser.tenant.active) {
    throw new AuthError("INACTIVE", "Barbearia desativada");
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    active: dbUser.active,
    tenantId: dbUser.tenantId,
    tenantName: dbUser.tenant?.name ?? null,
    tenantActive: dbUser.tenant?.active ?? true,
    permissions: permissionsForRole(dbUser.role),
  };
}

export async function requireTenantUser(): Promise<AuthenticatedUser & { tenantId: string }> {
  const user = await requireAuthenticatedUser();
  if (!user.tenantId) {
    throw new AuthError("TENANT_REQUIRED", "Usuário sem barbearia vinculada");
  }
  return { ...user, tenantId: user.tenantId };
}

export async function requireTenantAdmin(): Promise<AuthenticatedUser & { tenantId: string }> {
  const user = await requireTenantUser();
  if (!hasPermission(user, "settings:manage") && user.role !== "OWNER" && user.role !== "MANAGER") {
    if (user.role !== "SUPER_ADMIN") {
      throw new AuthError("FORBIDDEN", "Sem permissão administrativa");
    }
  }
  if (
    user.role !== "SUPER_ADMIN" &&
    user.role !== "OWNER" &&
    user.role !== "MANAGER"
  ) {
    throw new AuthError("FORBIDDEN", "Sem permissão administrativa");
  }
  return user;
}

export async function requirePermission(
  permission: Permission
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();
  if (!hasPermission(user, permission)) {
    throw new AuthError("FORBIDDEN", `Sem permissão: ${permission}`);
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();
  if (user.role !== "SUPER_ADMIN") {
    throw new AuthError("FORBIDDEN", "Acesso restrito à plataforma");
  }
  return user;
}

export function hasPermission(user: AuthenticatedUser, permission: Permission) {
  return user.permissions.includes(permission);
}

export function assertTenantResource(
  user: AuthenticatedUser,
  resourceTenantId: string,
  message = "Recurso de outra barbearia"
) {
  if (user.role === "SUPER_ADMIN") return;
  if (!user.tenantId || user.tenantId !== resourceTenantId) {
    throw new AuthError("FORBIDDEN", message);
  }
}

export function appointmentScopeFilter(user: AuthenticatedUser) {
  if (user.role === "BARBER" || !hasPermission(user, "agenda:view_all")) {
    return { barberId: user.id };
  }
  return {};
}

/** Verify cron secret from Authorization Bearer header */
export function requireCronSecret(authHeader: string | null) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new AuthError("FORBIDDEN", "CRON_SECRET não configurado");
  }
  if (authHeader !== `Bearer ${secret}`) {
    throw new AuthError("FORBIDDEN", "Cron não autorizado");
  }
}
