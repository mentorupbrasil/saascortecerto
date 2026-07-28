"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  canAccessComandas,
  itemIsActive,
  MoreHorizontal,
} from "@/lib/nav-config";
import type { UserRole } from "@/lib/auth-utils";
import { useMobileChrome } from "@/components/mobile/mobile-chrome-context";
import {
  Calendar,
  Clock,
  LayoutDashboard,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon };

export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { tabBarHidden, moreOpen, setMoreOpen } = useMobileChrome();

  if (!session?.user || tabBarHidden) return null;

  const role = session.user.role as UserRole;
  const showComandas = canAccessComandas(role);

  const tabs: Tab[] = [
    { href: "/dashboard", label: "Hoje", icon: LayoutDashboard },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/clientes", label: "Clientes", icon: Users },
    showComandas
      ? { href: "/comandas", label: "Comandas", icon: ShoppingCart }
      : { href: "/lista-espera", label: "Espera", icon: Clock },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegação principal"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = itemIsActive(pathname, tab.href);
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                  active ? "text-amber-400" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            aria-label="Mais opções"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-full w-full min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
              moreOpen ? "text-amber-400" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
