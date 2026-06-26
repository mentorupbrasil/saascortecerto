import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { LandingHeroPreview } from "@/components/marketing/landing-hero-preview";
import { formatPlanPrice, PLAN_LABELS, PLAN_WHATSAPP_DESCRIPTION } from "@/lib/plan-pricing";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import { ArrowRight, Check } from "lucide-react";

const pillars = [
  {
    num: "01",
    title: "Agenda que vende horário",
    desc: "Grade semanal clara e link público para o cliente escolher e reservar sozinho — ideal para grupos de WhatsApp.",
  },
  {
    num: "02",
    title: "Clientes que voltam",
    desc: "Histórico completo, alertas de quem sumiu e mensagens de retorno prontas para enviar.",
  },
  {
    num: "03",
    title: "Operação sob controle",
    desc: "Equipe com permissões, serviços editáveis, clube de assinatura e faturamento do dia na palma da mão.",
  },
];

const capabilities = [
  "Agenda visual semanal",
  "Link de agendamento online",
  "Cadastro e histórico de clientes",
  "Retorno via WhatsApp",
  "Clube de assinatura",
  "Gestão de equipe",
  "Ambiente isolado por barbearia",
  "Ativação automática após pagamento",
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
    q: "Qual a diferença entre Pro e Completo?",
    a: `Pro (${formatPlanPrice("PRO")}/mês): alertas e WhatsApp manual com mensagem pronta. Completo (${formatPlanPrice("CLUBE")}/mês): inclui disparo automático via API.`,
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
    <div className="min-h-screen bg-[#060606] text-white landing-grain">
      <SiteHeader />

      {/* Hero */}
      <section className="relative pt-[4.5rem] overflow-hidden">
        <div className="landing-glow absolute inset-0 pointer-events-none" />
        <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] landing-grid-lines opacity-30 pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 lg:px-10 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-zinc-400 mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                Software para barbearias modernas
              </p>

              <h1 className="font-display text-[2.75rem] sm:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-white">
                Sua barbearia,
                <span className="block text-[var(--gold)] italic font-normal mt-1">
                  organizada e lucrativa.
                </span>
              </h1>

              <p className="mt-8 text-lg text-zinc-400 leading-relaxed font-light max-w-md">
                Agenda, clientes, retorno no WhatsApp e link para o cliente marcar sozinho — em
                uma plataforma elegante, feita para quem leva a barbearia a sério.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/assinar"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all hover:bg-[#d4b56e] hover:shadow-[0_0_40px_-8px_rgba(201,169,98,0.5)]"
                >
                  Começar — {formatPlanPrice("PRO")}/mês
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-8 py-4 text-sm uppercase tracking-[0.08em] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Já sou cliente
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-[12px] uppercase tracking-[0.15em] text-zinc-600">
                <span>Sem planilha</span>
                <span>·</span>
                <span>Dados isolados</span>
                <span>·</span>
                <span>Suporte humano</span>
              </div>
            </div>

            <LandingHeroPreview />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="funcionalidades" className="border-t border-white/[0.06] py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="max-w-2xl mb-16 lg:mb-20">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--gold)] mb-4">
              Funcionalidades
            </p>
            <h2 className="font-display text-4xl lg:text-5xl text-white leading-tight">
              Tudo o essencial.
              <span className="text-zinc-500"> Nada supérfluo.</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {pillars.map((p) => (
              <div
                key={p.num}
                className="bg-[#060606] p-8 lg:p-10 group hover:bg-[#0a0a0a] transition-colors"
              >
                <span className="font-display text-5xl text-white/[0.06] group-hover:text-[var(--gold)]/20 transition-colors">
                  {p.num}
                </span>
                <h3 className="font-display text-2xl text-white mt-4 mb-3">{p.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {capabilities.map((cap) => (
              <div
                key={cap}
                className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3.5"
              >
                <Check className="h-3.5 w-3.5 text-[var(--gold)] shrink-0" strokeWidth={2} />
                <span className="text-sm text-zinc-400">{cap}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="border-t border-white/[0.06] py-24 bg-[#080808]">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--gold)] mb-4">
                Como funciona
              </p>
              <h2 className="font-display text-4xl text-white leading-tight mb-6">
                Do cadastro ao primeiro corte agendado em minutos.
              </h2>
              <p className="text-zinc-500 leading-relaxed">
                Sem consultoria cara, sem implementação demorada. Você assina, paga online e
                recebe acesso imediato ao painel da sua barbearia.
              </p>
            </div>
            <ol className="space-y-8">
              {[
                { step: "Assine o plano", detail: "Pro ou Completo — escolha o que combina com você." },
                { step: "Configure em 10 min", detail: "Serviços, horários e equipe. Pronto para usar." },
                { step: "Compartilhe o link", detail: "Clientes agendam sozinhos; você foca no atendimento." },
              ].map((item, i) => (
                <li key={item.step} className="flex gap-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--gold)]/30 text-sm font-medium text-[var(--gold)]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-white">{item.step}</p>
                    <p className="text-sm text-zinc-500 mt-1">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="border-t border-white/[0.06] py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--gold)] mb-4">Planos</p>
            <h2 className="font-display text-4xl lg:text-5xl text-white">
              Investimento claro. Retorno diário.
            </h2>
            <p className="mt-4 text-zinc-500">
              Preço fixo mensal. Cancele quando quiser.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <PricingCard
              plan="PRO"
              tagline={PLAN_WHATSAPP_DESCRIPTION.PRO}
              features={[
                "Agenda, clientes e serviços",
                "Link público de agendamento",
                "Clube de assinatura",
                "Dashboard e equipe",
                "Ambiente exclusivo",
              ]}
            />
            <PricingCard
              plan="CLUBE"
              featured
              tagline={PLAN_WHATSAPP_DESCRIPTION.CLUBE}
              features={[
                "Tudo do plano Pro",
                "Disparo automático WhatsApp",
                "Cron diário de retorno",
                "Ideal para alto volume",
                "Ambiente exclusivo",
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/[0.06] py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <div className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--gold)] mb-4">Dúvidas</p>
            <h2 className="font-display text-4xl text-white">Perguntas frequentes</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-6">
                <summary className="cursor-pointer list-none flex justify-between items-start gap-4 font-medium text-white hover:text-[var(--gold)] transition-colors">
                  {faq.q}
                  <span className="text-zinc-600 group-open:rotate-45 transition-transform text-xl shrink-0 leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-sm text-zinc-500 leading-relaxed pr-8">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="border-t border-white/[0.06] py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--gold)]/20 bg-gradient-to-br from-[#0c0c0c] to-[#080808] px-8 py-16 lg:px-16 lg:py-20 text-center">
            <div className="absolute inset-0 landing-glow opacity-50" />
            <div className="relative">
              <h2 className="font-display text-4xl lg:text-5xl text-white max-w-xl mx-auto leading-tight">
                Pronto para elevar o nível da sua barbearia?
              </h2>
              <p className="mt-4 text-zinc-500 max-w-md mx-auto">
                Dúvidas? Escreva para{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-[var(--gold)] hover:underline"
                >
                  {supportEmail}
                </a>
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/assinar"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#0a0a0a] hover:bg-[#d4b56e] transition-colors"
                >
                  Assinar agora
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-10 py-4 text-sm uppercase tracking-[0.08em] text-zinc-300 hover:text-white transition-colors"
                >
                  Entrar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gold)]/30">
              <span className="font-display text-sm text-[var(--gold)]">C</span>
            </div>
            <span className="font-display text-lg text-white">CorteCerto</span>
          </div>
          <p className="text-xs text-zinc-600 uppercase tracking-[0.15em]">
            © {new Date().getFullYear()} — Gestão premium para barbearias
          </p>
          <Link
            href="/login"
            className="text-xs uppercase tracking-[0.15em] text-zinc-500 hover:text-[var(--gold)] transition-colors"
          >
            Área do cliente
          </Link>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  plan,
  featured,
  tagline,
  features,
}: {
  plan: "PRO" | "CLUBE";
  featured?: boolean;
  tagline: string;
  features: string[];
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-8 lg:p-10 ${
        featured
          ? "border-2 border-[var(--gold)]/40 bg-[var(--gold)]/[0.04] shadow-[0_0_60px_-20px_rgba(201,169,98,0.25)]"
          : "border border-white/[0.08] bg-[#0a0a0a]"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-8 rounded-full bg-[var(--gold)] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0a0a0a]">
          Recomendado
        </span>
      )}
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{PLAN_LABELS[plan]}</p>
      <p className="font-display text-5xl text-white mt-3">
        {formatPlanPrice(plan)}
        <span className="text-lg font-sans font-normal text-zinc-600">/mês</span>
      </p>
      <p className="text-sm text-zinc-500 mt-3 pb-8 border-b border-white/[0.06]">{tagline}</p>
      <ul className="mt-8 space-y-4 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
            <Check className="h-4 w-4 text-[var(--gold)] shrink-0 mt-0.5" strokeWidth={1.5} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={`/assinar?plan=${plan}`}
        className={`mt-10 block text-center rounded-full py-4 text-sm font-semibold uppercase tracking-[0.08em] transition-all ${
          featured
            ? "bg-[var(--gold)] text-[#0a0a0a] hover:bg-[#d4b56e]"
            : "border border-white/10 text-white hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
        }`}
      >
        Escolher {PLAN_LABELS[plan]}
      </Link>
    </div>
  );
}
