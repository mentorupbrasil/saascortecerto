"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

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

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-white/[0.06] bg-[#060606]/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(201,169,98,0.08)]"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[var(--gold-muted)] blur-md opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)]/30 bg-[#0c0c0c]">
              <span className="font-display text-lg text-[var(--gold)]">C</span>
            </div>
          </div>
          <div className="leading-none">
            <span className="font-display text-xl tracking-wide text-white">CorteCerto</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
              Barbearias
            </span>
          </div>
        </Link>

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
          className="lg:hidden text-zinc-400 p-2"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
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
        <div className="lg:hidden border-t border-white/[0.06] bg-[#060606]/95 backdrop-blur-xl px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block text-sm uppercase tracking-widest text-zinc-400"
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
