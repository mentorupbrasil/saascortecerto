import { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  tenantName?: string | null;
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Admin Plataforma",
  OWNER: "Dono",
  MANAGER: "Gerente",
  BARBER: "Barbeiro",
  RECEPTIONIST: "Recepcionista",
};

export function isSuperAdmin(user: SessionUser) {
  return user.role === "SUPER_ADMIN";
}

export function isTenantAdmin(user: SessionUser) {
  return user.role === "SUPER_ADMIN" || user.role === "OWNER" || user.role === "MANAGER";
}

export function canManageUsers(user: SessionUser) {
  return user.role === "SUPER_ADMIN" || user.role === "OWNER";
}

export function canManageServices(user: SessionUser) {
  return isTenantAdmin(user);
}

export function canViewAllAppointments(user: SessionUser) {
  return user.role !== "BARBER";
}

export function canManageTenants(user: SessionUser) {
  return user.role === "SUPER_ADMIN";
}

export function requireTenantId(user: SessionUser): string {
  if (!user.tenantId) {
    throw new Error("Usuário sem barbearia vinculada");
  }
  return user.tenantId;
}

export function getAppointmentFilter(user: SessionUser) {
  if (user.role === "BARBER") {
    return { barberId: user.id };
  }
  return {};
}
