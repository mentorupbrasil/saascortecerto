"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const navLinks = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "Dúvidas" },
  { href: "#contato", label: "Contato" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500 safe-top",
        scrolled
          ? "border-b border-white/[0.06] bg-[#060606]/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(201,169,98,0.08)]"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo variant="compact" href="/" priority className="h-9 sm:h-10" />

        <nav className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-[var(--gold)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/login"
            className="text-[13px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-white px-2 py-2"
          >
            Entrar
          </Link>
          <Link
            href="/assinar"
            className="inline-flex items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--gold)] transition-all hover:bg-[var(--gold)] hover:text-[#0a0a0a]"
          >
            Assinar
          </Link>
        </div>

        <button
          className="lg:hidden text-zinc-400 p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="lg:hidden border-t border-white/[0.06] bg-[#060606]/98 backdrop-blur-xl px-4 py-5 space-y-1 safe-bottom max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3.5 text-sm uppercase tracking-widest text-zinc-300 min-h-[44px] flex items-center"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-4 flex flex-col gap-3 border-t border-white/[0.06]">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-center py-3 text-sm text-zinc-300"
            >
              Entrar
            </Link>
            <Link
              href="/assinar"
              onClick={() => setOpen(false)}
              className="text-center rounded-full bg-[var(--gold)] py-3 text-sm font-medium text-[#0a0a0a]"
            >
              Assinar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
