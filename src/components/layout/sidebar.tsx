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
} from "lucide-react";
import { useState } from "react";
import { isSuperAdmin, isTenantAdmin } from "@/lib/auth-utils";
import type { Role } from "@prisma/client";

const navItems = [
  { href: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/clube", label: "Clube", icon: Crown, adminOnly: true },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: true },
  { href: "/servicos", label: "Serviços", icon: Scissors, adminOnly: true },
  { href: "/equipe", label: "Equipe", icon: UserCog, ownerOnly: true },
  { href: "/admin", label: "Admin", icon: Shield, superAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const user = {
    role: session.user.role as Role,
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
      <div className="mb-8 px-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-black">
            ✂️
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CorteCerto</h1>
            {user.tenantName && (
              <p className="text-xs text-zinc-500 truncate max-w-[160px]">{user.tenantName}</p>
            )}
          </div>
        </div>
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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
        className="fixed left-4 top-4 z-40 rounded-xl bg-zinc-900 p-2 text-white lg:hidden border border-zinc-800"
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 p-4 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-zinc-400 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        <NavContent />
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 pt-16 lg:pt-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
