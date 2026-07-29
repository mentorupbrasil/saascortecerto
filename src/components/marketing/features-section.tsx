"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Globe2,
  MessageCircle,
  Package,
  Percent,
  Scissors,
  Users,
  UsersRound,
  Wallet,
  Crown,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { formatPlanPrice } from "@/lib/plan-pricing";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

const MODULES = [
  { label: "Clientes", icon: Users },
  { label: "Agenda", icon: CalendarDays },
  { label: "Financeiro", icon: Wallet },
  { label: "Equipe", icon: UsersRound },
  { label: "Serviços", icon: Scissors },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Portal", icon: Globe2 },
  { label: "WhatsApp", icon: MessageCircle },
  { label: "Comandas", icon: CreditCard },
  { label: "Estoque", icon: Package },
  { label: "Comissões", icon: Percent },
  { label: "Clube", icon: Crown },
] as const;

const FEATURE_HIGHLIGHTS = [
  {
    title: "Agenda e portal online",
    description:
      "Calendário por profissional, status de atendimento e link público para o cliente marcar sozinho — com PIX quando você quiser.",
  },
  {
    title: "Caixa, comandas e estoque",
    description:
      "Venda serviços e produtos no balcão, controle o caixa do dia e saiba o que está acabando na prateleira.",
  },
  {
    title: "Relatórios, comissões e clube",
    description:
      "Veja faturamento e ocupação, calcule comissão da equipe e ofereça planos de assinatura para fidelizar clientes.",
  },
];

export function FeaturesSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="recursos"
      className="relative overflow-hidden border-b border-border bg-background py-12 md:py-16 lg:py-20"
    >
      <div className="section relative">
        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12 xl:gap-14">
          <div>
            <p className="mb-2 text-sm font-medium sm:mb-3">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Funcionalidades
              </span>
            </p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.1]">
              Tudo o que você controla com o {brand.name}
            </h2>
            <p className="text-pretty mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base sm:leading-7">
              12 módulos para organizar clientes, agenda, financeiro, equipe e operação — sem
              juntar caderno, planilha e WhatsApp.
            </p>

            <div className="mt-5 hidden gap-3 sm:mt-7 sm:flex sm:flex-row sm:flex-wrap">
              <Link
                href="#modulos"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:h-11 sm:px-7"
              >
                Ver todos os módulos
              </Link>
              <Link
                href="/assinar?plan=PRO"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-transparent px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 sm:h-11 sm:px-7"
              >
                Começar por {formatPlanPrice("PRO")}
              </Link>
            </div>
          </div>

          <motion.div
            id="modulos"
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            whileInView={reduceMotion ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 22 }}
            className="scroll-mt-24 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:scroll-mt-28 sm:p-5 lg:p-6"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mb-4">
              Principais módulos
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {MODULES.map((mod, index) => (
                <motion.div
                  key={mod.label}
                  initial={reduceMotion ? false : { y: 12, opacity: 0 }}
                  whileInView={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                  className={cn(
                    "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-1.5 py-2.5 text-center sm:min-h-[88px] sm:gap-2 sm:px-2 sm:py-3"
                  )}
                >
                  <mod.icon
                    className="h-5 w-5 text-primary sm:h-6 sm:w-6"
                    strokeWidth={1.6}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium leading-tight text-foreground sm:text-sm">
                    {mod.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <Link
            href="/assinar?plan=PRO"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:hidden"
          >
            Começar por {formatPlanPrice("PRO")}
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3 md:gap-5">
          {FEATURE_HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5"
            >
              <h3 className="text-sm font-semibold text-foreground sm:text-base">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:mt-2">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
