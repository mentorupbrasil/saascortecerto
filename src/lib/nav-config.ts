import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Users,
  Scissors,
  LayoutDashboard,
  Shield,
  UserCog,
  MessageCircle,
  Crown,
  Receipt,
  Wallet,
  Banknote,
  ShoppingCart,
  Package,
  Percent,
  Clock,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { isSuperAdmin, isTenantAdmin, type UserRole } from "@/lib/auth-utils";

export type NavFlags = {
  adminOnly?: boolean;
  ownerOnly?: boolean;
  superAdminOnly?: boolean;
  financeViewOnly?: boolean;
  financeSellOnly?: boolean;
  financeOpsOnly?: boolean;
  inventoryOnly?: boolean;
  agendaEditOnly?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
} & NavFlags;

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/comandas", label: "Comandas", icon: ShoppingCart, financeSellOnly: true },
      { href: "/admin", label: "Admin", icon: Shield, superAdminOnly: true },
    ],
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    items: [
      { href: "/lista-espera", label: "Lista de espera", icon: Clock, agendaEditOnly: true },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: true },
      { href: "/clube", label: "Clube", icon: Crown, adminOnly: true },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      { href: "/servicos", label: "Serviços", icon: Scissors, adminOnly: true },
      { href: "/equipe", label: "Equipe", icon: UserCog, ownerOnly: true },
      { href: "/estoque", label: "Estoque", icon: Package, inventoryOnly: true },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { href: "/caixa", label: "Caixa", icon: Banknote, financeOpsOnly: true },
      { href: "/financeiro", label: "Financeiro", icon: Wallet, financeViewOnly: true },
      { href: "/faturamento", label: "Faturamento", icon: Receipt, adminOnly: true },
      { href: "/comissoes", label: "Comissões", icon: Percent, financeViewOnly: true },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, financeViewOnly: true },
    ],
  },
];

export function itemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function filterNavGroups(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
}) {
  const canFinanceView =
    user.role === "OWNER" || user.role === "MANAGER" || user.role === "SUPER_ADMIN";
  const canFinanceSell =
    canFinanceView || user.role === "RECEPTIONIST" || user.role === "BARBER";
  const canFinanceOps = canFinanceView || user.role === "RECEPTIONIST";
  const canInventory = canFinanceView || user.role === "RECEPTIONIST";
  const canAgendaEdit =
    canFinanceView || user.role === "RECEPTIONIST" || user.role === "BARBER";

  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin(user)) return false;
        if (item.ownerOnly && !isTenantAdmin(user)) return false;
        if (item.adminOnly && !isTenantAdmin(user)) return false;
        if (item.financeViewOnly && !canFinanceView) return false;
        if (item.financeSellOnly && !canFinanceSell) return false;
        if (item.financeOpsOnly && !canFinanceOps) return false;
        if (item.inventoryOnly && !canInventory) return false;
        if (item.agendaEditOnly && !canAgendaEdit) return false;
        if (item.href !== "/admin" && isSuperAdmin(user) && !user.tenantId) {
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function canAccessComandas(role: UserRole) {
  return (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "SUPER_ADMIN" ||
    role === "RECEPTIONIST" ||
    role === "BARBER"
  );
}

export const mobilePrimaryTabs = [
  { href: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/comandas", label: "Comandas", icon: ShoppingCart, financeSellOnly: true as const },
] as const;

export { MoreHorizontal };
