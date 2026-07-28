"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMobileChrome } from "@/components/mobile/mobile-chrome-context";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

const TITLES: Record<string, string> = {
  "/dashboard": "Hoje",
  "/agenda": "Agenda",
  "/clientes": "Clientes",
  "/comandas": "Comandas",
  "/caixa": "Caixa",
  "/financeiro": "Financeiro",
  "/estoque": "Estoque",
  "/comissoes": "Comissões",
  "/servicos": "Serviços",
  "/equipe": "Equipe",
  "/lista-espera": "Lista de espera",
  "/whatsapp": "WhatsApp",
  "/clube": "Clube",
  "/relatorios": "Relatórios",
  "/faturamento": "Faturamento",
  "/admin": "Admin",
};

export function MobileTopBar({ action }: { action?: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { setMoreOpen, tabBarHidden } = useMobileChrome();

  if (!session?.user || tabBarHidden) return null;

  const base = "/" + (pathname.split("/")[1] || "");
  const title = TITLES[base] || TITLES[pathname] || "CorteCerto";
  const tenantName = session.user.tenantName;

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur safe-top lg:hidden"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-card text-foreground"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {tenantName && (
            <p className="truncate text-xs text-muted-foreground">{tenantName}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
