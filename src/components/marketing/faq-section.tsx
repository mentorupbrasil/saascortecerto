"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const FAQS: Record<FaqCategory, { question: string; answer: string }[]> = {
  "primeiros-passos": [
    {
      question: "Preciso instalar alguma coisa?",
      answer:
        "Não. O Cortzo funciona 100% no navegador — no celular, tablet ou computador. Depois do pagamento, você acessa o painel na hora, sem baixar app nem instalar programa.",
    },
    {
      question: "Funciona no celular?",
      answer:
        "Sim. A agenda, o cadastro de clientes e o link de agendamento foram pensados para o dia a dia no celular. Você gerencia a barbearia de onde estiver.",
    },
    {
      question: "Como começo a usar depois de assinar?",
      answer:
        "Após a confirmação do pagamento, entre com o e-mail e a senha que cadastrou. Em poucos minutos você configura serviços, horários e profissionais — e já pode compartilhar o link de agendamento com os clientes.",
    },
    {
      question: "Minha barbearia fica separada das outras?",
      answer: `Sim. Cada assinatura cria um ambiente exclusivo: login, clientes, agenda e histórico só da sua barbearia. Os dados nunca se misturam com outras contas no ${brand.name}.`,
    },
  ],
  planos: [
    {
      question: `Qual a diferença entre ${PLAN_LABELS.PRO} e ${PLAN_LABELS.CLUBE}?`,
      answer: `${PLAN_LABELS.PRO} (${formatPlanPrice("PRO")}/mês) é o essencial: agenda, clientes, serviços, até ${PLAN_SEAT_LIMITS.PRO} acessos de equipe e link de agendamento. ${PLAN_LABELS.CLUBE} (${formatPlanPrice("CLUBE")}/mês) inclui tudo isso, com até ${PLAN_SEAT_LIMITS.CLUBE} acessos, relatórios completos, recursos avançados e automações.`,
    },
    {
      question: "Tem desconto no plano anual?",
      answer: `Sim. No toggle Anual (−20%) você paga o equivalente a 12 meses com desconto. Exemplo: ${PLAN_LABELS.PRO} fica ${formatMoneyBRL(getPlanCheckoutAmount("PRO", "yearly"))}/ano e ${PLAN_LABELS.CLUBE} ${formatMoneyBRL(getPlanCheckoutAmount("CLUBE", "yearly"))}/ano.`,
    },
    {
      question: "Posso cancelar quando quiser?",
      answer:
        "Sim, sem multa e sem fidelidade. Basta avisar o suporte para interromper a renovação. Você continua usando até o fim do período já pago.",
    },
    {
      question: "Como funciona o pagamento?",
      answer:
        "Você escolhe o plano (mensal ou anual), preenche o cadastro da barbearia e paga via PIX ou cartão. A conta é liberada automaticamente após a confirmação.",
    },
  ],
  recursos: [
    {
      question: "Como o cliente agenda pelo link?",
      answer:
        "Você compartilha o link público da sua barbearia. O cliente escolhe o serviço, vê os horários livres e confirma. O agendamento entra na sua agenda sem você precisar marcar manualmente.",
    },
    {
      question: "Consigo cadastrar a equipe e os serviços?",
      answer:
        "Sim. Cadastre profissionais, define horários de atendimento e lista os serviços com preço e duração. Tudo fica organizado no mesmo painel.",
    },
    {
      question: "Tem histórico de clientes?",
      answer:
        "Sim. Você guarda telefone, preferências e histórico de atendimentos para facilitar o retorno e melhorar o relacionamento com cada cliente.",
    },
    {
      question: "O WhatsApp entra em qual plano?",
      answer: `No ${PLAN_LABELS.PRO} você usa alertas e envio manual pelo WhatsApp (wa.me). No ${PLAN_LABELS.CLUBE} há disparo automático via API, ideal para lembretes e retorno de clientes.`,
    },
  ],
};

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      animate={isOpen ? "open" : "closed"}
      className={cn(
        "rounded-xl border border-border/80 transition-colors",
        isOpen ? "bg-muted/50" : "bg-card shadow-sm"
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "text-base font-medium leading-snug transition-colors sm:text-lg",
            isOpen ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {question}
        </span>
        <motion.span
          variants={{
            open: { rotate: "45deg" },
            closed: { rotate: "0deg" },
          }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <Plus
            className={cn(
              "h-5 w-5 transition-colors",
              isOpen ? "text-foreground" : "text-muted-foreground"
            )}
          />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          marginBottom: isOpen ? 16 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden px-4 sm:px-5"
      >
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{answer}</p>
      </motion.div>
    </motion.div>
  );
}

export function FaqSection() {
  const [selected, setSelected] = useState<FaqCategory>("primeiros-passos");
  const reduceMotion = useReducedMotion();
  const questions = FAQS[selected];

  return (
    <section
      id="faq"
      className="relative overflow-hidden border-b border-border bg-background px-4 py-12 text-foreground md:py-16 lg:py-20"
    >
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
        <span className="mb-5 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-sm font-medium text-transparent sm:mb-6">
          Perguntas comuns
        </span>
        <h2 className="text-balance mb-2 text-3xl font-bold tracking-tight sm:mb-4 sm:text-4xl lg:text-5xl">
          Dúvidas frequentes
        </h2>
        <span
          className={cn(
            "pointer-events-none absolute -top-[280px] left-1/2 z-0 h-[480px] w-[580px] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/30 blur-3xl",
            reduceMotion && "hidden"
          )}
          aria-hidden
        />
      </div>

      <div
        className="relative z-10 mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:mt-8 sm:gap-4"
        role="tablist"
        aria-label="Categorias de dúvidas"
      >
        {CATEGORIES.map((tab) => {
          const isSelected = selected === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelected(tab.id)}
              className={cn(
                "relative overflow-hidden whitespace-nowrap rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-500",
                isSelected
                  ? "border-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative z-10">{tab.label}</span>
              {!reduceMotion ? (
                <AnimatePresence>
                  {isSelected ? (
                    <motion.span
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: "100%" }}
                      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                      className="absolute inset-0 z-0 bg-gradient-to-r from-primary to-primary/80"
                    />
                  ) : null}
                </AnimatePresence>
              ) : (
                isSelected && <span className="absolute inset-0 z-0 bg-primary" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto mt-8 max-w-3xl md:mt-10" role="tabpanel">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="space-y-3 sm:space-y-4"
          >
            {questions.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
