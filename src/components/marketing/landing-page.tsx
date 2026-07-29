import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Settings2,
  Share2,
  UserPlus,
} from "lucide-react";

import { SiteHeader } from "@/components/marketing/site-header";
import { GlowyWavesHero } from "@/components/marketing/glowy-waves-hero";
import { CortzoDashboardMockup } from "@/components/marketing/cortzo-dashboard-mockup";
import { SectionShell } from "@/components/marketing/landing/section-shell";
import { Reveal } from "@/components/marketing/landing/reveal";
import { FeaturesSection } from "@/components/marketing/features-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { WhatsAppFloat } from "@/components/marketing/whatsapp-float";
import { formatPlanPrice } from "@/lib/plan-pricing";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import { brand } from "@/config/brand";
import { CortzoLockup } from "@/components/brand/brand-mark";

const trustItems = [
  "Ambiente exclusivo por barbearia",
  "Suporte humano",
  "Ativação automática após pagamento",
  "Cancele quando quiser",
];

const howItWorks = [
  {
    icon: UserPlus,
    step: "Crie sua conta",
    detail: "Escolha o plano ideal e cadastre sua barbearia em poucos minutos.",
  },
  {
    icon: Settings2,
    step: "Configure em minutos",
    detail: "Cadastre serviços, horários e equipe — pronto para usar no mesmo dia.",
  },
  {
    icon: Share2,
    step: "Compartilhe o link",
    detail: "Clientes agendam sozinhos enquanto você foca no atendimento.",
  },
];

export function LandingPage() {
  const supportEmail = getPlatformSupportEmail();

  return (
    <div className="landing min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteHeader />

      <GlowyWavesHero
        badge="Gestão completa para barbearias"
        title="Agenda, clientes e gestão"
        titleHighlight="em um só lugar"
        description="Organize horários, clientes, equipe e resultados da sua barbearia em uma plataforma simples, moderna e profissional."
        pills={["Agenda online", "Gestão de clientes", "Controle da equipe"]}
        primaryCta={{ label: `Começar por ${formatPlanPrice("PRO")}`, href: "/assinar?plan=PRO" }}
        secondaryCta={{ label: "Conhecer os recursos", href: "#recursos" }}
      >
        <CortzoDashboardMockup />
      </GlowyWavesHero>

      {/* Trust bar */}
      <section className="border-b border-border bg-background py-5 sm:py-6 md:py-8">
        <div className="section flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 sm:gap-x-8 sm:gap-y-3">
          {trustItems.map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:text-xs sm:tracking-[0.1em]"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      <FeaturesSection />

      {/* How it works */}
      <SectionShell
        id="como-funciona"
        eyebrow="Como funciona"
        title="Do cadastro ao primeiro corte agendado em minutos"
        description="Sem consultoria cara, sem implementação demorada. Você assina, paga online e recebe acesso imediato ao painel da sua barbearia."
        tone="muted"
      >
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3 md:gap-6">
          {howItWorks.map((item, index) => (
            <div key={item.step} className="card-elevated relative p-5 sm:p-6 lg:p-8">
              <div className="mb-4 flex items-center justify-between sm:mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 sm:h-11 sm:w-11">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <span className="text-2xl font-bold text-foreground/[0.08] sm:text-3xl">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground">{item.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* Pricing */}
      <SectionShell
        id="planos"
        eyebrow="Planos"
        title="Planos simples. Sem surpresa."
        description="Escolha mensal ou anual com 20% de desconto. Sem taxa de adesão."
      >
        <PricingSection />
      </SectionShell>

      <FaqSection />

      {/* Final CTA */}
      <section className="border-b border-border py-12 md:py-16 lg:py-20">
        <div className="section">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-graphite px-5 py-8 text-center text-white shadow-[0_28px_72px_-24px_rgba(0,0,0,0.4)] sm:rounded-[28px] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12]" aria-hidden />
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
                aria-hidden
              />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-balance text-[1.65rem] font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                  Pronto para elevar o nível da sua barbearia?
                </h2>
                <p className="text-pretty mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:mt-4 sm:text-lg">
                  Dúvidas? Escreva para{" "}
                  <a href={`mailto:${supportEmail}`} className="font-medium text-primary hover:underline">
                    {supportEmail}
                  </a>
                </p>
                <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
                  <Link
                    href="/assinar?plan=PRO"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    Assinar agora
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                  >
                    Entrar
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="safe-bottom py-6 sm:py-8">
        <div className="section flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:gap-6 sm:text-left">
          <CortzoLockup size={28} productClassName="text-lg" />
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.15em]">
            © {new Date().getFullYear()} {brand.legalName} — {brand.byline}
          </p>
          <Link
            href="/login"
            className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary sm:text-xs sm:tracking-[0.15em]"
          >
            Área do cliente
          </Link>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
