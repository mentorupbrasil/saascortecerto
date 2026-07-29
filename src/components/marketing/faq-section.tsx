"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  formatPlanPrice,
  getPlanCheckoutAmount,
  formatMoneyBRL,
  PLAN_LABELS,
  PLAN_SEAT_LIMITS,
} from "@/lib/plan-pricing";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type FaqCategory = "primeiros-passos" | "planos" | "recursos";

const CATEGORIES: { id: FaqCategory; label: string }[] = [
  { id: "primeiros-passos", label: "Primeiros passos" },
  { id: "planos", label: "Planos" },
  { id: "recursos", label: "Recursos" },
];

const FAQS: {
  category: FaqCategory;
  q: string;
  a: string;
}[] = [
  {
    category: "primeiros-passos",
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Cortzo funciona 100% no navegador — no celular, tablet ou computador. Depois do pagamento, você acessa o painel na hora, sem baixar app nem instalar programa.",
  },
  {
    category: "primeiros-passos",
    q: "Funciona no celular?",
    a: "Sim. A agenda, o cadastro de clientes e o link de agendamento foram pensados para o dia a dia no celular. Você gerencia a barbearia de onde estiver.",
  },
  {
    category: "primeiros-passos",
    q: "Como começo a usar depois de assinar?",
    a: "Após a confirmação do pagamento, entre com o e-mail e a senha que cadastrou. Em poucos minutos você configura serviços, horários e profissionais — e já pode compartilhar o link de agendamento com os clientes.",
  },
  {
    category: "primeiros-passos",
    q: "Minha barbearia fica separada das outras?",
    a: `Sim. Cada assinatura cria um ambiente exclusivo: login, clientes, agenda e histórico só da sua barbearia. Os dados nunca se misturam com outras contas no ${brand.name}.`,
  },
  {
    category: "planos",
    q: `Qual a diferença entre ${PLAN_LABELS.PRO} e ${PLAN_LABELS.CLUBE}?`,
    a: `${PLAN_LABELS.PRO} (${formatPlanPrice("PRO")}/mês) é o essencial: agenda, clientes, serviços, até ${PLAN_SEAT_LIMITS.PRO} acessos de equipe e link de agendamento. ${PLAN_LABELS.CLUBE} (${formatPlanPrice("CLUBE")}/mês) inclui tudo isso, com até ${PLAN_SEAT_LIMITS.CLUBE} acessos, relatórios completos, recursos avançados e automações.`,
  },
  {
    category: "planos",
    q: "Tem desconto no plano anual?",
    a: `Sim. No toggle Anual (−20%) você paga o equivalente a 12 meses com desconto. Exemplo: ${PLAN_LABELS.PRO} fica ${formatMoneyBRL(getPlanCheckoutAmount("PRO", "yearly"))}/ano e ${PLAN_LABELS.CLUBE} ${formatMoneyBRL(getPlanCheckoutAmount("CLUBE", "yearly"))}/ano.`,
  },
  {
    category: "planos",
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem multa e sem fidelidade. Basta avisar o suporte para interromper a renovação. Você continua usando até o fim do período já pago.",
  },
  {
    category: "planos",
    q: "Como funciona o pagamento?",
    a: "Você escolhe o plano (mensal ou anual), preenche o cadastro da barbearia e paga via PIX ou cartão. A conta é liberada automaticamente após a confirmação.",
  },
  {
    category: "recursos",
    q: "Como o cliente agenda pelo link?",
    a: "Você compartilha o link público da sua barbearia. O cliente escolhe o serviço, vê os horários livres e confirma. O agendamento entra na sua agenda sem você precisar marcar manualmente.",
  },
  {
    category: "recursos",
    q: "Consigo cadastrar a equipe e os serviços?",
    a: "Sim. Cadastre profissionais, define horários de atendimento e lista os serviços com preço e duração. Tudo fica organizado no mesmo painel.",
  },
  {
    category: "recursos",
    q: "Tem histórico de clientes?",
    a: "Sim. Você guarda telefone, preferências e histórico de atendimentos para facilitar o retorno e melhorar o relacionamento com cada cliente.",
  },
  {
    category: "recursos",
    q: "O WhatsApp entra em qual plano?",
    a: `No ${PLAN_LABELS.PRO} você usa alertas e envio manual pelo WhatsApp (wa.me). No ${PLAN_LABELS.CLUBE} há disparo automático via API, ideal para lembretes e retorno de clientes.`,
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        open ? "border-primary/35" : "border-border"
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px] sm:px-6 sm:py-5"
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">{q}</span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
          aria-hidden
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="answer"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-6 sm:text-[15px] sm:leading-7">
              {a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [category, setCategory] = useState<FaqCategory>("primeiros-passos");
  const items = FAQS.filter((faq) => faq.category === category);

  return (
    <section id="faq" className="relative overflow-hidden border-b border-border bg-muted/25 py-16 md:py-20 lg:py-24">
      <div className="section-glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="section relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm font-medium text-primary">Perguntas comuns</p>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.65rem] lg:leading-[1.12]">
            Dúvidas frequentes
          </h2>
        </div>

        <div
          className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2 md:mt-10"
          role="tablist"
          aria-label="Categorias de dúvidas"
        >
          {CATEGORIES.map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.id)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px]",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-foreground hover:border-primary/40"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-6 max-w-3xl space-y-3 md:mt-8" role="tabpanel">
          {items.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
