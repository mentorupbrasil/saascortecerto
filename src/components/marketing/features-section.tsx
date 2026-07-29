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
      className="relative overflow-hidden border-b border-border bg-background py-16 md:py-20 lg:py-24"
    >
      <div className="section relative">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Funcionalidades
            </p>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.5rem] lg:leading-[1.15]">
              Tudo o que você controla com o {brand.name}
            </h2>
            <p className="text-pretty mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-8">
              12 módulos para organizar clientes, agenda, financeiro, equipe e operação — sem
              juntar caderno, planilha e WhatsApp.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="#modulos"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Ver todos os módulos
              </Link>
              <Link
                href="/assinar?plan=PRO"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                Começar por {formatPlanPrice("PRO")}
              </Link>
            </div>
          </div>

          <motion.div
            id="modulos"
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            whileInView={reduceMotion ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 22 }}
            className="scroll-mt-28 rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6 lg:p-7"
          >
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Principais módulos
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {MODULES.map((mod, index) => (
                <motion.div
                  key={mod.label}
                  initial={reduceMotion ? false : { y: 12, opacity: 0 }}
                  whileInView={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.03, duration: 0.35 }}
                  className={cn(
                    "flex min-h-[96px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/80 bg-background px-2 py-4 text-center transition-colors hover:border-primary/35 hover:bg-primary/[0.04]"
                  )}
                >
                  <mod.icon className="h-7 w-7 text-primary" strokeWidth={1.6} aria-hidden />
                  <span className="text-sm font-medium text-foreground">{mod.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5 lg:mt-14">
          {FEATURE_HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
            >
              <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
