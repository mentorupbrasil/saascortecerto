"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Star } from "lucide-react";
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
  const isYearly = billing === "yearly";

  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          !isYearly ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Mensal
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isYearly}
        aria-label="Alternar cobrança anual"
        onClick={() => onChange(isYearly ? "monthly" : "yearly")}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isYearly ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            isYearly ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      <span
        className={cn(
          "text-sm font-semibold transition-colors",
          isYearly ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Anual <span className="text-primary">(−20%)</span>
      </span>
    </div>
  );
}

function PricingCard({
  plan,
  badge,
  featured,
  billing,
}: {
  plan: "PRO" | "CLUBE";
  badge: string;
  featured?: boolean;
  billing: PlanBilling;
}) {
  const seats = PLAN_SEAT_LIMITS[plan];
  const yearlyTotal = getPlanCheckoutAmount(plan, "yearly");

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-6 text-center lg:p-8",
        featured
          ? "z-10 border-2 border-primary bg-card shadow-lg shadow-primary/10 md:-translate-y-1 md:scale-[1.02]"
          : "border border-border bg-card shadow-sm"
      )}
    >
      <div className="absolute right-0 top-0 flex items-center rounded-bl-xl rounded-tr-xl bg-primary px-2 py-1">
        {featured ? (
          <Star className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" aria-hidden />
        ) : null}
        <span className="ml-1 font-sans text-xs font-semibold text-primary-foreground">
          {badge}
        </span>
      </div>

      <p className="mt-2 text-base font-semibold text-muted-foreground">{PLAN_LABELS[plan]}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
        Até {seats} {seats === 1 ? "acesso" : "acessos"}
      </p>

      <div className="mt-6 flex items-end justify-center gap-1">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
          {formatPlanPrice(plan, billing)}
        </span>
        <span className="pb-1 text-sm font-semibold text-muted-foreground">/mês</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {billing === "monthly"
          ? "cobrança mensal"
          : `equivalente mensal no plano anual (−20%) · ${formatMoneyBRL(yearlyTotal)}/ano`}
      </p>

      <ul className="mt-6 flex flex-col gap-2 text-left">
        {PLAN_MARKETING_FEATURES[plan].map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <hr className="my-6 w-full border-border" />

      <Link
        href={`/assinar?plan=${plan}&billing=${billing}`}
        className={cn(
          "flex min-h-[48px] w-full items-center justify-center rounded-full text-sm font-semibold transition-colors",
          featured
            ? "bg-primary text-primary-foreground hover:bg-primary-hover"
            : "border border-border text-foreground hover:border-primary/40 hover:bg-primary hover:text-primary-foreground"
        )}
      >
        Escolher {PLAN_LABELS[plan]}
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

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-start gap-5 md:grid-cols-2">
        {(
          [
            { plan: "PRO" as const, badge: "Para começar", featured: false },
            { plan: "CLUBE" as const, badge: "Mais escolhido", featured: true },
          ] as const
        ).map((item, index) => (
          <motion.div
            key={item.plan}
            initial={reduceMotion ? false : { y: 28, opacity: 0 }}
            whileInView={
              reduceMotion
                ? undefined
                : {
                    y: item.featured ? -8 : 0,
                    opacity: 1,
                  }
            }
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.55,
              delay: index * 0.08,
              type: "spring",
              stiffness: 120,
              damping: 22,
            }}
          >
            <PricingCard
              plan={item.plan}
              badge={item.badge}
              featured={item.featured}
              billing={billing}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
