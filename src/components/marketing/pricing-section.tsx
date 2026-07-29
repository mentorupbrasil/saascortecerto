"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  formatPlanPrice,
  getPlanCheckoutAmount,
  formatMoneyBRL,
  PLAN_LABELS,
  PLAN_MARKETING_FEATURES,
  PLAN_SEAT_LIMITS,
  type PlanBilling,
} from "@/lib/plan-pricing";
import { cn } from "@/lib/utils";

function BillingToggle({
  billing,
  onChange,
}: {
  billing: PlanBilling;
  onChange: (value: PlanBilling) => void;
}) {
  return (
    <div className="mb-8 flex justify-center sm:mb-10">
      <div
        className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 p-1 shadow-sm"
        role="group"
        aria-label="Periodicidade do plano"
      >
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={cn(
            "min-h-[40px] rounded-full px-5 text-sm font-semibold transition-all sm:min-h-[44px] sm:px-6",
            billing === "monthly"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={cn(
            "inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all sm:min-h-[44px] sm:px-5",
            billing === "yearly"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Anual
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide",
              billing === "yearly"
                ? "bg-primary text-primary-foreground"
                : "bg-primary/20 text-[#1e2723] dark:text-primary"
            )}
          >
            −20%
          </span>
        </button>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  badge,
  featured,
  billing,
  description,
}: {
  plan: "PRO" | "CLUBE";
  badge: string;
  featured?: boolean;
  billing: PlanBilling;
  description: string;
}) {
  const seats = PLAN_SEAT_LIMITS[plan];
  const yearlyTotal = getPlanCheckoutAmount(plan, "yearly");
  const priceLabel = formatPlanPrice(plan, billing);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[1.75rem] p-6 sm:p-7 lg:p-8",
        featured
          ? "border border-primary/40 bg-gradient-to-b from-primary/[0.12] via-card to-card shadow-[0_24px_60px_-28px_rgba(114,227,173,0.55)] ring-1 ring-primary/20"
          : "border border-border/80 bg-card shadow-[0_18px_48px_-28px_rgba(0,0,0,0.28)]"
      )}
    >
      {featured ? (
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-primary/25 blur-3xl"
          aria-hidden
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-tight text-foreground">{PLAN_LABELS[plan]}</p>
          <p className="mt-1.5 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide",
            featured
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-muted-foreground"
          )}
        >
          {badge}
        </span>
      </div>

      <div className="relative mt-7">
        <div className="flex items-end gap-1.5">
          <span className="pb-1 text-sm font-medium text-muted-foreground">R$</span>
          <span className="text-5xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[3.25rem]">
            {priceLabel.replace(/^R\$\s?/, "")}
          </span>
          <span className="pb-1.5 text-sm font-medium text-muted-foreground">/mês</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {billing === "monthly" ? (
            <>Até {seats} acessos · cobrança mensal</>
          ) : (
            <>
              Até {seats} acessos · {formatMoneyBRL(yearlyTotal)}/ano
            </>
          )}
        </p>
      </div>

      <ul className="relative mt-7 flex flex-1 flex-col gap-3">
        {PLAN_MARKETING_FEATURES[plan].map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-foreground/90">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                featured ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
              )}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/assinar?plan=${plan}&billing=${billing}`}
        className={cn(
          "group relative mt-8 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
          featured
            ? "bg-graphite text-white hover:bg-primary hover:text-primary-foreground"
            : "border border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary hover:text-primary-foreground"
        )}
      >
        Assinar {PLAN_LABELS[plan]}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}

export function PricingSection() {
  const [billing, setBilling] = useState<PlanBilling>("monthly");
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <BillingToggle billing={billing} onChange={setBilling} />

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6">
        {(
          [
            {
              plan: "PRO" as const,
              badge: "Essencial",
              featured: false,
              description: "Organização completa para começar com o pé direito.",
            },
            {
              plan: "CLUBE" as const,
              badge: "Mais escolhido",
              featured: true,
              description: "Para barbearias que querem escala, relatórios e automações.",
            },
          ] as const
        ).map((item, index) => (
          <motion.div
            key={item.plan}
            className="h-full"
            initial={reduceMotion ? false : { y: 20, opacity: 0 }}
            whileInView={reduceMotion ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.45,
              delay: index * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <PricingCard
              plan={item.plan}
              badge={item.badge}
              featured={item.featured}
              billing={billing}
              description={item.description}
            />
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground sm:mt-8 sm:text-sm">
        Sem taxa de adesão · Ativação após o pagamento · Cancele quando quiser
      </p>
    </div>
  );
}
