"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { BrandMark, CortzoLockup } from "@/components/brand/brand-mark";
import {
  LogOut,
  X,
  AlertTriangle,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { UserRole } from "@/lib/auth-utils";
import type { BillingAlertProps } from "@/lib/billing-actions";
import type { TenantAlert } from "@/lib/alerts";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  filterNavGroups,
  itemIsActive,
  type NavGroup,
  type NavItem,
} from "@/lib/nav-config";
import {
  MobileChromeProvider,
  useMobileChrome,
} from "@/components/mobile/mobile-chrome-context";
import { MobileTabBar } from "@/components/mobile/mobile-tab-bar";
import { MobileTopBar } from "@/components/mobile/mobile-top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { AlertsBell } from "@/components/layout/alerts-bell";

export type { BillingAlertProps } from "@/lib/billing-actions";

const SIDEBAR_EXPANDED = 264;
const SIDEBAR_COLLAPSED = 72;
const COLLAPSE_KEY = "cortzo.sidebar.collapsed";

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
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
        collapsed ? "justify-center px-2 py-2" : "px-2.5 py-2",
        active
          ? "bg-amber-500/15 text-amber-400"
          : "text-zinc-400 hover:bg-zinc-800/80 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-amber-400")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-foreground shadow-lg group-hover:block">
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
        {isCollapsed ? (
          <BrandMark className="h-9 w-auto" size={36} />
        ) : (
          <CortzoLockup size={32} productClassName="text-base" />
        )}
        {onNavigate && !isCollapsed && (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-foreground lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showCollapseToggle && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center",
              !isCollapsed && !onNavigate && "ml-auto"
            )}
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
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors min-h-[36px]",
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
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={isCollapsed ? "Sair" : undefined}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-lg text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400 min-h-[44px]",
            isCollapsed ? "justify-center px-2 py-2" : "px-2.5 py-2"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );
}

function SidebarInner({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { moreOpen, setMoreOpen } = useMobileChrome();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const closeMobile = useCallback(() => setMoreOpen(false), [setMoreOpen]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.role, user?.tenantId]
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, setMoreOpen]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

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
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(100vw-3rem,264px)] flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:hidden safe-top",
          moreOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!moreOpen}
      >
        <SidebarChrome
          {...chromeProps}
          isCollapsed={false}
          onNavigate={closeMobile}
          showCollapseToggle={false}
        />
      </aside>

      <aside
        className="fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex"
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

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}) {
  return (
    <SidebarInner collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
  );
}

export function AppShell({
  children,
  billingAlert,
  alerts = [],
}: {
  children: React.ReactNode;
  billingAlert?: BillingAlertProps | null;
  alerts?: TenantAlert[];
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
    <MobileChromeProvider>
      <ToastProvider>
        <div className="min-h-dvh overflow-x-hidden bg-background">
          <Sidebar collapsed={collapsed} onCollapsedChange={handleCollapsedChange} />
          <MobileTopBar action={<AlertsBell alerts={alerts} />} />
          <main
            className={cn(
              "min-h-dvh transition-[padding] duration-200",
              collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
            )}
          >
            <div
              className="mx-auto max-w-5xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pt-6 lg:px-8 lg:pt-8 lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="mb-4 hidden justify-end lg:flex">
                <AlertsBell alerts={alerts} />
              </div>
              {billingAlert?.message && pathname !== "/faturamento" && (
                <BillingAlertBanner alert={billingAlert} />
              )}
              {children}
            </div>
          </main>
          <MobileTabBar />
        </div>
      </ToastProvider>
    </MobileChromeProvider>
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
          className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-white/20 min-h-[44px] flex items-center justify-center"
        >
          Ver plano e cobrança
        </Link>
      )}
    </div>
  );
}
