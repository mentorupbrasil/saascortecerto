"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
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
        className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent p-1"
        role="group"
        aria-label="Periodicidade do plano"
      >
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={cn(
            "relative overflow-hidden rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            billing === "monthly"
              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={cn(
            "relative inline-flex items-center gap-2 overflow-hidden rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            billing === "yearly"
              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Anual
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              billing === "yearly"
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-primary/15 text-foreground"
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

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 sm:p-7",
        featured
          ? "border-primary/30 shadow-[0_20px_56px_rgba(0,0,0,0.08)] ring-1 ring-primary/15 md:-translate-y-1 md:scale-[1.02]"
          : "border-border/80 hover:border-primary/20"
      )}
    >
      <div className="mb-5">
        {featured ? (
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {badge}
          </span>
        ) : (
          <span className="mb-2 inline-block rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        )}
        <h3 className="text-xl font-semibold text-foreground">{PLAN_LABELS[plan]}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {formatPlanPrice(plan, billing)}
          <span className="text-sm font-medium text-muted-foreground">/mês</span>
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {billing === "monthly"
            ? `Até ${seats} acessos · cobrança mensal`
            : `Até ${seats} acessos · ${formatMoneyBRL(yearlyTotal)}/ano`}
        </p>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {PLAN_MARKETING_FEATURES[plan].map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/assinar?plan=${plan}&billing=${billing}`}
        className={cn(
          "inline-flex min-h-[44px] w-full items-center justify-center rounded-full text-sm font-semibold transition-colors",
          featured
            ? "bg-graphite text-white hover:bg-primary hover:text-primary-foreground"
            : "border border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/10"
        )}
      >
        Começar com {PLAN_LABELS[plan]}
      </Link>
    </article>
  );
}

export function PricingSection() {
  const [billing, setBilling] = useState<PlanBilling>("monthly");
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <BillingToggle billing={billing} onChange={setBilling} />

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-5">
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
              badge: "Mais popular",
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
            transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sem taxa de adesão · Ativação após o pagamento · Cancele quando quiser
      </p>
    </div>
  );
}
