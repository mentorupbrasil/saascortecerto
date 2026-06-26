import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { formatPlanPrice, PLAN_LABELS, PLAN_WHATSAPP_DESCRIPTION } from "@/lib/plan-pricing";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import {
  Calendar,
  Users,
  MessageCircle,
  Crown,
  Scissors,
  UserCog,
  Shield,
  Check,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agenda visual",
    desc: "Grade semanal + link público para clientes agendarem sozinhos pelo WhatsApp.",
  },
  {
    icon: Users,
    title: "Clientes",
    desc: "Cadastro completo, foto, histórico de visitas e alerta de quem está sumindo.",
  },
  {
    icon: MessageCircle,
    title: "Retorno WhatsApp",
    desc: "Pro: sistema avisa quem contatar e abre mensagem pronta. Completo: disparo automático.",
  },
  {
    icon: Crown,
    title: "Clube de assinatura",
    desc: "Planos mensais para clientes fiéis — pacotes, limites de visita e fidelidade.",
  },
  {
    icon: Scissors,
    title: "Serviços e valores",
    desc: "Cadastre cortes, barba, combos. Edite preços e duração quando quiser.",
  },
  {
    icon: UserCog,
    title: "Equipe",
    desc: "Dono, gerente, barbeiro e recepcionista — cada um vê só o que precisa.",
  },
  {
    icon: BarChart3,
    title: "Dashboard do dia",
    desc: "Faturamento do dia, clientes atendidos e fila de retorno na tela inicial.",
  },
  {
    icon: Shield,
    title: "Dados isolados",
    desc: "Cada barbearia tem seu ambiente separado. Seus dados nunca se misturam com outros.",
  },
];

const faqs = [
  {
    q: "Cada barbearia fica separada?",
    a: "Sim. Ao assinar, criamos um ambiente exclusivo para sua barbearia. Seus clientes, agenda e equipe são só seus — ninguém mais acessa.",
  },
  {
    q: "Quantos usuários posso ter?",
    a: "Ilimitados dentro do seu plano. Cadastre barbeiros, recepcionista e gerentes com permissões diferentes.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Escolha o plano, cadastre sua barbearia e pague online. Após confirmação, sua conta é liberada automaticamente para login.",
  },
  {
    q: "Qual a diferença Pro e Completo?",
    a: "Pro (R$ 39,90): alertas + WhatsApp manual com mensagem pronta. Completo (R$ 59,90): tudo do Pro + envio automático via API.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Entre em contato conosco. Sem multa, sem burocracia.",
  },
];

export function LandingPage() {
  const supportEmail = getPlatformSupportEmail();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-amber-400 font-medium mb-3">Gestão inteligente para barbearias</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Agenda, clientes e WhatsApp — tudo num só lugar
            </h1>
            <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
              Pare de perder cliente por esquecimento. O CorteCerto organiza sua barbearia, avisa
              quem está sumindo e traz o pessoal de volta — sem planilha, sem caos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/assinar">
                <Button size="lg" className="w-full sm:w-auto">
                  Começar agora — a partir de {formatPlanPrice("PRO")}/mês
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Já tenho conta
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-500">
              ✓ Ambiente exclusivo por barbearia &nbsp;·&nbsp; ✓ Ativação automática após pagamento
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20 border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4">Tudo que sua barbearia precisa</h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-12">
            Desenvolvido para barbearias de verdade — do dono solo ao time com vários cadeiras.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors"
              >
                <f.icon className="h-8 w-8 text-amber-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20 border-b border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4">Planos simples, sem surpresa</h2>
          <p className="text-zinc-400 text-center mb-12">
            Escolha, pague e comece a usar. Sua barbearia é criada automaticamente.
          </p>
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
            <PlanCard
              plan="PRO"
              highlighted={false}
              features={[
                "Agenda, clientes e serviços",
                "Dashboard e equipe",
                "Clube de assinatura",
                PLAN_WHATSAPP_DESCRIPTION.PRO,
                "Ambiente exclusivo isolado",
              ]}
            />
            <PlanCard
              plan="CLUBE"
              highlighted
              features={[
                "Tudo do plano Pro",
                PLAN_WHATSAPP_DESCRIPTION.CLUBE,
                "Envio em massa e cron diário",
                "Ideal para barbearias com muitos clientes",
                "Ambiente exclusivo isolado",
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 border-b border-zinc-800">
        <div className="mx-auto max-w-2xl px-4 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-10">Perguntas frequentes</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
              >
                <summary className="cursor-pointer font-medium text-white list-none flex justify-between items-center">
                  {faq.q}
                  <span className="text-zinc-500 group-open:rotate-45 transition-transform text-xl">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contato" className="py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Fale conosco</h2>
          <p className="text-zinc-400 mb-6">
            Dúvidas antes de assinar? Estamos aqui para ajudar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={`mailto:${supportEmail}`}
              className="text-amber-400 hover:underline text-lg"
            >
              {supportEmail}
            </a>
            <Link href="/assinar">
              <Button size="lg">Assinar CorteCerto</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-600">
        <p>© {new Date().getFullYear()} CorteCerto — Gestão para barbearias</p>
        <Link href="/login" className="text-zinc-500 hover:text-zinc-300 mt-2 inline-block">
          Área do cliente
        </Link>
      </footer>
    </div>
  );
}

function PlanCard({
  plan,
  highlighted,
  features,
}: {
  plan: "PRO" | "CLUBE";
  highlighted?: boolean;
  features: string[];
}) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col ${
        highlighted
          ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      {highlighted && (
        <span className="text-xs font-medium text-amber-400 mb-2">Mais popular</span>
      )}
      <h3 className="text-xl font-bold">{PLAN_LABELS[plan]}</h3>
      <p className="text-3xl font-bold text-white mt-2">
        {formatPlanPrice(plan)}
        <span className="text-base font-normal text-zinc-500">/mês</span>
      </p>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <Link href={`/assinar?plan=${plan}`} className="mt-8">
        <Button className="w-full" variant={highlighted ? "primary" : "secondary"}>
          Assinar {PLAN_LABELS[plan]}
        </Button>
      </Link>
    </div>
  );
}
