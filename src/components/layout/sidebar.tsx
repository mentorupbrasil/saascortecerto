"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Users,
  Scissors,
  LayoutDashboard,
  Shield,
  UserCog,
  LogOut,
  Menu,
  X,
  MessageCircle,
  Crown,
  Receipt,
  AlertTriangle,
  Wallet,
  Banknote,
  ShoppingCart,
  Package,
  Percent,
  Clock,
  BarChart3,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { isSuperAdmin, isTenantAdmin } from "@/lib/auth-utils";
import type { UserRole } from "@/lib/auth-utils";
import type { BillingAlertProps } from "@/lib/billing-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type { BillingAlertProps } from "@/lib/billing-actions";

const SIDEBAR_EXPANDED = 264;
const SIDEBAR_COLLAPSED = 72;
const COLLAPSE_KEY = "cortecerto.sidebar.collapsed";

type NavFlags = {
  adminOnly?: boolean;
  ownerOnly?: boolean;
  superAdminOnly?: boolean;
  financeViewOnly?: boolean;
  financeSellOnly?: boolean;
  financeOpsOnly?: boolean;
  inventoryOnly?: boolean;
  agendaEditOnly?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
} & NavFlags;

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
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

function itemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function filterNavGroups(user: {
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

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors min-h-[40px]",
        collapsed ? "justify-center px-2 py-2" : "px-2.5 py-2",
        active
          ? "bg-amber-500/15 text-amber-400"
          : "text-zinc-400 hover:bg-zinc-800/80 hover:text-white"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-amber-400")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
          {item.label}
        </span>
      )}
    </Link>
  );
}

function SidebarChrome({
  user,
  filteredGroups,
  pathname,
  openGroups,
  toggleGroup,
  isCollapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    tenantName?: string | null;
  };
  filteredGroups: NavGroup[];
  pathname: string;
  openGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  isCollapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-zinc-800",
          isCollapsed ? "justify-center gap-1 px-2 py-3" : "gap-2 px-3 py-3"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-base font-bold text-black">
          ✂️
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">CorteCerto</h1>
            {user.tenantName && (
              <p className="truncate text-[11px] text-zinc-500">{user.tenantName}</p>
            )}
          </div>
        )}
        {onNavigate && !isCollapsed && (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showCollapseToggle && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {filteredGroups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            const hasActive = group.items.some((item) =>
              itemIsActive(pathname, item.href)
            );

            if (isCollapsed) {
              return (
                <div key={group.id} className="space-y-0.5 pb-2">
                  <div className="mx-auto mb-1 h-px w-6 bg-zinc-800" aria-hidden />
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={itemIsActive(pathname, item.href)}
                      collapsed
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              );
            }

            return (
              <div key={group.id} className="pb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    hasActive ? "text-amber-500/90" : "text-zinc-500 hover:text-zinc-300"
                  )}
                  aria-expanded={isOpen}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={itemIsActive(pathname, item.href)}
                        collapsed={false}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-zinc-800",
          isCollapsed ? "px-2 py-3" : "px-3 py-3"
        )}
      >
        {!isCollapsed && (
          <div className="mb-2 min-w-0 px-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={isCollapsed ? "Sair" : undefined}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-lg text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400 min-h-[40px]",
            isCollapsed ? "justify-center px-2 py-2" : "px-2.5 py-2"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!isCollapsed && <span>Sair</span>}
          {isCollapsed && (
            <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
              Sair
            </span>
          )}
        </button>
      </div>
    </>
  );
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        role: session.user.role as UserRole,
        tenantId: session.user.tenantId ?? null,
        tenantName: session.user.tenantName,
      }
    : null;

  const filteredGroups = useMemo(
    () => (user ? filterNavGroups(user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role/tenant drive permissions
    [user?.id, user?.role, user?.tenantId]
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of filteredGroups) {
        if (group.items.some((item) => itemIsActive(pathname, item.href))) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [pathname, filteredGroups]);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!user) return null;

  const chromeProps = {
    user,
    filteredGroups,
    pathname,
    openGroups,
    toggleGroup,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-white safe-top lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(100vw-3rem,264px)] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform lg:hidden safe-top",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        <SidebarChrome
          {...chromeProps}
          isCollapsed={false}
          onNavigate={closeMobile}
          showCollapseToggle={false}
        />
      </aside>

      <aside
        className="fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 lg:flex"
        style={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
      >
        <SidebarChrome
          {...chromeProps}
          isCollapsed={collapsed}
          showCollapseToggle
          onToggleCollapse={() => onCollapsedChange(!collapsed)}
        />
      </aside>
    </>
  );
}

export function AppShell({
  children,
  billingAlert,
}: {
  children: React.ReactNode;
  billingAlert?: BillingAlertProps | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function handleCollapsedChange(value: boolean) {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-zinc-950">
      <Sidebar collapsed={collapsed} onCollapsedChange={handleCollapsedChange} />
      <main
        className={cn(
          "min-h-dvh transition-[padding] duration-200",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
        )}
      >
        <div className="mx-auto max-w-5xl px-4 py-5 pt-[4.5rem] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-16 lg:px-8 lg:pt-8">
          {billingAlert?.message && pathname !== "/faturamento" && (
            <BillingAlertBanner alert={billingAlert} />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function BillingAlertBanner({ alert }: { alert: BillingAlertProps }) {
  const styles =
    alert.level === "overdue"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : alert.level === "due_soon"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-blue-500/20 bg-blue-500/10 text-blue-100";

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${styles}`}
    >
      <div className="flex flex-1 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{alert.message}</p>
          {alert.amount !== null && alert.dueDate && (
            <p className="mt-1 text-xs opacity-80">
              {formatCurrency(alert.amount)} — vencimento{" "}
              {format(new Date(alert.dueDate), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>
      {alert.invoiceId && (
        <Link
          href="/faturamento"
          className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-white/20"
        >
          Ver plano e cobrança
        </Link>
      )}
    </div>
  );
}
