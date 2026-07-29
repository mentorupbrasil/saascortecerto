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
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.08 },
  },
};

const primaryButtonClasses =
  "inline-flex h-12 items-center justify-center rounded-full bg-graphite px-8 text-base font-medium text-white transition-colors hover:bg-primary-hover";

const secondaryButtonClasses =
  "inline-flex h-12 items-center justify-center rounded-full border border-border/60 bg-card/50 px-8 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card";

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
      className="relative isolate w-full overflow-hidden border-b border-border/40 bg-background md:min-h-[calc(100vh-4rem)]"
      aria-label="Cortzo"
    >
      <div
        className="pointer-events-none absolute -right-40 -top-16 z-0 flex flex-col items-end blur-2xl md:-right-60"
        aria-hidden="true"
      >
        <div className="h-40 w-[min(60rem,120vw)] rounded-full bg-gradient-to-b from-primary/50 to-accent/40 blur-[6rem]" />
        <div className="h-40 w-[min(90rem,140vw)] rounded-full bg-gradient-to-b from-secondary/80 to-primary/20 blur-[6rem]" />
        <div className="h-40 w-[min(60rem,120vw)] rounded-full bg-gradient-to-b from-accent/60 to-primary/30 blur-[6rem]" />
      </div>

      <div
        className="pointer-events-none absolute -left-32 bottom-0 z-0 h-72 w-72 rounded-full bg-primary/15 blur-[5rem] md:h-96 md:w-96"
        aria-hidden="true"
      />

      <div className="absolute inset-0 z-0 bg-noise opacity-[0.22]" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 text-center sm:px-6 sm:py-10 md:px-8 lg:px-12 lg:pb-10 lg:pt-14">
        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? "visible" : "hidden"}
          animate="visible"
          className="w-full"
        >
          <motion.div
            variants={itemVariants}
            className="mx-auto mb-4 flex max-w-fit items-center justify-center gap-2 rounded-full border border-border/40 bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm sm:mb-6 sm:px-4 sm:py-2 sm:text-sm"
          >
            <span>{badge}</span>
            <ArrowRight className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" aria-hidden="true" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mx-auto mb-4 max-w-4xl text-[1.85rem] font-bold leading-[1.15] tracking-tight text-foreground sm:mb-6 sm:text-4xl md:text-6xl lg:text-7xl"
          >
            {title}{" "}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground/70 bg-clip-text text-transparent">
              {titleHighlight}
            </span>
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
                className="rounded-full border border-border/50 bg-card/60 px-3 py-1.5 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card hover:shadow-sm sm:px-4 sm:py-2"
              >
                {pill}
              </li>
            ))}
          </motion.ul>

          {stats && stats.length > 0 ? (
            <motion.div
              variants={statsVariants}
              className={cn(
                "mx-auto grid max-w-3xl gap-4 rounded-2xl border border-border/50 bg-card/70 p-5 backdrop-blur-sm",
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
              <div
                className="pointer-events-none absolute inset-x-6 top-1/4 h-40 rounded-3xl bg-primary/25 opacity-50 blur-[5rem] sm:inset-x-12 sm:h-56 sm:blur-[6rem]"
                aria-hidden="true"
              />
              <FloatVisual className="relative">{children}</FloatVisual>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
