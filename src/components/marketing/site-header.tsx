"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CortzoLockup } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/marketing/theme-toggle";

const navLinks = [
  { href: "#recursos", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "Dúvidas" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="glass safe-top sticky top-0 z-50 h-16 border-b border-border/60">
      <div className="section flex h-16 items-center justify-between">
        <Link href="/" className="group min-w-0">
          <CortzoLockup size={30} productClassName="text-lg tracking-tight" />
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle compact />
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            href="/assinar?plan=PRO"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Começar agora
          </Link>
        </div>

        <button
          className="lg:hidden -mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-muted-foreground"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div
          className={cn(
            "glass lg:hidden border-t border-border/60 px-6 py-5 safe-bottom",
            "max-h-[calc(100dvh-4rem)] overflow-y-auto"
          )}
        >
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center py-3 text-sm font-medium text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-center py-3 text-sm font-medium text-muted-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/assinar?plan=PRO"
              onClick={() => setOpen(false)}
              className="rounded-full bg-primary py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              Começar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
