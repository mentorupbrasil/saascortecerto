"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { isSuperAdmin, isTenantAdmin } from "@/lib/auth-utils";
import type { UserRole } from "@/lib/auth-utils";
import type { BillingAlertProps } from "@/lib/billing-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type { BillingAlertProps } from "@/lib/billing-actions";

const navItems = [
  { href: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/clube", label: "Clube", icon: Crown, adminOnly: true },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: true },
  { href: "/servicos", label: "Serviços", icon: Scissors, adminOnly: true },
  { href: "/equipe", label: "Equipe", icon: UserCog, ownerOnly: true },
  { href: "/faturamento", label: "Faturamento", icon: Receipt, adminOnly: true },
  { href: "/admin", label: "Admin", icon: Shield, superAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!session?.user) return null;

  const user = {
    role: session.user.role as UserRole,
    tenantId: session.user.tenantId,
    tenantName: session.user.tenantName,
    name: session.user.name,
    email: session.user.email,
    id: session.user.id,
  };

  const filteredNav = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin(user)) return false;
    if (item.ownerOnly && !isTenantAdmin(user)) return false;
    if (item.adminOnly && !isTenantAdmin(user)) return false;
    if (item.href !== "/admin" && isSuperAdmin(user) && !user.tenantId) {
      return false;
    }
    return true;
  });

  const NavContent = () => (
    <>
      <div className="mb-8 px-1">
        <Logo variant="compact" href="/dashboard" className="h-9" />
        {user.tenantName && (
          <p className="text-xs text-zinc-500 truncate max-w-[160px] mt-2 px-1">{user.tenantName}</p>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 sm:py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                active
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 pt-4">
        <div className="mb-3 px-2">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-zinc-900 p-2.5 text-white lg:hidden border border-zinc-800 safe-top min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,16rem)] sm:w-64 flex-col border-r border-zinc-800 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform lg:translate-x-0 safe-top",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-zinc-400 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        <NavContent />
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

  return (
    <div className="min-h-screen bg-zinc-950 overflow-x-hidden">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-5 pt-[4.5rem] sm:pt-16 lg:pt-8 lg:px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
    <div className={`mb-6 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${styles}`}>
      <div className="flex items-start gap-3 flex-1">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">{alert.message}</p>
          {alert.amount !== null && alert.dueDate && (
            <p className="text-xs opacity-80 mt-1">
              {formatCurrency(alert.amount)} — vencimento{" "}
              {format(new Date(alert.dueDate), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>
      {alert.invoiceId && (
        <Link
          href="/faturamento"
          className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors text-center"
        >
          Ver fatura e pagar
        </Link>
      )}
    </div>
  );
}
