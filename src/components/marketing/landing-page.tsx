import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ShieldCheck,
  Settings2,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { SiteHeader } from "@/components/marketing/site-header";
import { GlowyWavesHero } from "@/components/marketing/glowy-waves-hero";
import { CortzoDashboardMockup } from "@/components/marketing/cortzo-dashboard-mockup";
import { SectionShell } from "@/components/marketing/landing/section-shell";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/landing/reveal";
import { PricingSection } from "@/components/marketing/pricing-section";
import {
  formatPlanPrice,
  PLAN_LABELS,
  PLAN_SEAT_LIMITS,
} from "@/lib/plan-pricing";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import { brand } from "@/config/brand";
import { CortzoLockup } from "@/components/brand/brand-mark";

const benefits = [
  {
    icon: Calendar,
    title: "Agenda organizada",
    description: "Visualize horários, profissionais e serviços sem confusão.",
  },
  {
    icon: Users,
    title: "Clientes mais próximos",
    description: "Tenha histórico e informações importantes para melhorar o atendimento.",
  },
  {
    icon: BarChart3,
    title: "Gestão sob controle",
    description: "Acompanhe a operação da barbearia em um painel simples e profissional.",
  },
];

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

const faqs = [
  {
    q: "Minha barbearia fica separada das outras?",
    a: "Sim. Cada assinatura cria um ambiente exclusivo com login, clientes e agenda próprios. Seus dados nunca se misturam com outras barbearias.",
  },
  {
    q: "Como o cliente agenda pelo link?",
    a: "Você compartilha o link da sua barbearia. O cliente escolhe serviço, vê horários livres e confirma. Você recebe aviso do novo agendamento.",
  },
  {
    q: `Qual a diferença entre ${PLAN_LABELS.PRO} e ${PLAN_LABELS.CLUBE}?`,
    a: `${PLAN_LABELS.PRO} (${formatPlanPrice("PRO")}/mês): até ${PLAN_SEAT_LIMITS.PRO} acessos de equipe e o essencial para organizar a barbearia. ${PLAN_LABELS.CLUBE} (${formatPlanPrice("CLUBE")}/mês): até ${PLAN_SEAT_LIMITS.CLUBE} acessos, relatórios completos e recursos avançados. No plano anual você economiza 20%.`,
  },
  {
    q: "Tem desconto no plano anual?",
    a: "Sim. Ao escolher cobrança anual na seção de planos, você paga o equivalente a 12 meses com 20% de desconto.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não. Funciona no navegador do celular ou computador. Assine, pague e acesse imediatamente após a confirmação.",
  },
  {
    q: "Posso cancelar?",
    a: "Sim, sem multa. Entre em contato quando quiser interromper a assinatura.",
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
      <section className="border-b border-border bg-background py-8">
        <div className="section flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {trustItems.map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <SectionShell
        id="recursos"
        eyebrow="Recursos"
        title="Tudo o que sua barbearia precisa, sem complicação"
        description="Recursos pensados para o dia a dia de quem administra uma barbearia — do balcão à agenda online."
      >
        <RevealGroup className="grid gap-5 sm:grid-cols-1 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <RevealItem key={benefit.title}>
              <div className="card-elevated card-interactive h-full p-6 lg:p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <benefit.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </SectionShell>

      {/* How it works */}
      <SectionShell
        id="como-funciona"
        eyebrow="Como funciona"
        title="Do cadastro ao primeiro corte agendado em minutos"
        description="Sem consultoria cara, sem implementação demorada. Você assina, paga online e recebe acesso imediato ao painel da sua barbearia."
        tone="muted"
      >
        <div className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((item, index) => (
            <div key={item.step} className="card-elevated relative p-6 lg:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <span className="text-3xl font-bold text-foreground/[0.08]">
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
        title="Investimento claro. Retorno diário."
        description="Preço transparente, sem taxa de adesão. Economize 20% no plano anual."
      >
        <PricingSection />
      </SectionShell>

      {/* FAQ */}
      <SectionShell
        id="faq"
        eyebrow="Dúvidas"
        title="Perguntas frequentes"
        className="border-b-0"
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group card-elevated overflow-hidden p-0 open:border-primary/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-foreground transition-colors hover:text-primary">
                {faq.q}
                <Sparkles className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-open:opacity-100" aria-hidden />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </SectionShell>

      {/* Final CTA */}
      <section className="border-b border-border py-16 md:py-20 lg:py-24">
        <div className="section">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-graphite px-6 py-10 text-center text-white shadow-[0_28px_72px_-24px_rgba(0,0,0,0.4)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12]" aria-hidden />
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
                aria-hidden
              />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                  Pronto para elevar o nível da sua barbearia?
                </h2>
                <p className="text-pretty mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                  Dúvidas? Escreva para{" "}
                  <a href={`mailto:${supportEmail}`} className="font-medium text-primary hover:underline">
                    {supportEmail}
                  </a>
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      <footer className="safe-bottom py-8">
        <div className="section flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
          <CortzoLockup size={28} productClassName="text-lg" />
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            © {new Date().getFullYear()} {brand.legalName} — {brand.byline}
          </p>
          <Link
            href="/login"
            className="text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary"
          >
            Área do cliente
          </Link>
        </div>
      </footer>
    </div>
  );
}
