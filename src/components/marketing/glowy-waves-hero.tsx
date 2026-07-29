"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { FloatVisual } from "@/components/marketing/landing/reveal";
import { cn } from "@/lib/utils";

export interface GlowyWavesHeroProps {
  badge: string;
  title: string;
  titleHighlight: string;
  description: string;
  pills: readonly string[];
  stats?: readonly { label: string; value: string }[];
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  children?: React.ReactNode;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.06 },
  },
};

const primaryButtonClasses =
  "inline-flex h-12 items-center justify-center rounded-full bg-graphite px-8 text-base font-semibold text-white transition-colors hover:bg-primary hover:text-primary-foreground";

const secondaryButtonClasses =
  "inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-8 text-base font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10";

export function GlowyWavesHero({
  badge,
  title,
  titleHighlight,
  description,
  pills,
  stats,
  primaryCta,
  secondaryCta,
  children,
}: GlowyWavesHeroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="relative w-full overflow-hidden border-b border-border bg-background"
      aria-label="Cortzo"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 text-center sm:px-6 sm:py-10 md:px-8 lg:px-12 lg:pb-12 lg:pt-14">
        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? "visible" : "hidden"}
          animate="visible"
          className="w-full"
        >
          <motion.div
            variants={itemVariants}
            className="mx-auto mb-4 flex max-w-fit items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground sm:mb-6 sm:px-4 sm:py-2 sm:text-sm"
          >
            <span>{badge}</span>
            <ArrowRight className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" aria-hidden="true" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mx-auto mb-4 max-w-4xl text-[1.85rem] font-bold leading-[1.15] tracking-tight text-foreground sm:mb-6 sm:text-4xl md:text-6xl lg:text-7xl"
          >
            {title}{" "}
            <span className="text-primary">{titleHighlight}</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mb-8 sm:text-lg md:text-xl"
          >
            {description}
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mb-6 flex w-full flex-col items-stretch justify-center gap-3 sm:mb-8 sm:flex-row sm:items-center sm:gap-4"
          >
            <Link href={primaryCta.href} className={cn(primaryButtonClasses, "w-full sm:w-auto")}>
              {primaryCta.label}
            </Link>
            <Link href={secondaryCta.href} className={cn(secondaryButtonClasses, "w-full sm:w-auto")}>
              {secondaryCta.label}
            </Link>
          </motion.div>

          <motion.ul
            variants={itemVariants}
            className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:mb-8 sm:gap-3 sm:text-xs sm:tracking-[0.15em]"
          >
            {pills.map((pill) => (
              <li
                key={pill}
                className="rounded-full border border-border bg-card px-3 py-1.5 sm:px-4 sm:py-2"
              >
                {pill}
              </li>
            ))}
          </motion.ul>

          {stats && stats.length > 0 ? (
            <motion.div
              variants={statsVariants}
              className={cn(
                "mx-auto grid max-w-3xl gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm",
                stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
              )}
            >
              {stats.map((stat) => (
                <motion.div key={stat.label} variants={itemVariants} className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {stat.label}
                  </div>
                  <div className="text-2xl font-semibold text-foreground sm:text-3xl">{stat.value}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}

          {children ? (
            <motion.div variants={itemVariants} className="relative mx-auto mt-2 w-full max-w-6xl sm:mt-6">
              <FloatVisual className="relative">{children}</FloatVisual>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
