import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { brand } from "@/config/brand";

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="landing min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="section max-w-3xl py-12 md:py-16">
        <p className="mb-3 text-sm font-medium">
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Legal
          </span>
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em {updatedAt}</p>
        <div className="prose-legal mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {children}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-primary hover:underline">
            ← Voltar ao {brand.name}
          </Link>
        </p>
      </main>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground sm:text-lg">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
