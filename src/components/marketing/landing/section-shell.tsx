"use client";

import type { ReactNode } from "react";

import { Reveal } from "@/components/marketing/landing/reveal";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  id?: string;
  eyebrow?: string;
  /** "badge" = pill with ping dot; "plain" = minimal uppercase label */
  eyebrowStyle?: "badge" | "plain";
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "elevated";
  align?: "center" | "left";
}

export function SectionShell({
  id,
  eyebrow,
  eyebrowStyle = "badge",
  title,
  description,
  children,
  className,
  tone = "default",
  align = "center",
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden border-b border-border py-16 md:py-20 lg:py-24",
        tone === "muted" && "bg-muted/25",
        tone === "elevated" && "bg-card/40",
        tone === "default" && "bg-background",
        className
      )}
    >
      {tone === "muted" ? (
        <div className="section-glow pointer-events-none absolute inset-0" aria-hidden />
      ) : null}

      <div className="section relative">
        <Reveal>
          <div
            className={cn(
              "mx-auto max-w-3xl",
              align === "center" ? "text-center" : "text-left"
            )}
          >
            {eyebrow ? (
              eyebrowStyle === "plain" ? (
                <p
                  className={cn(
                    "mb-3 text-xs font-medium uppercase tracking-[0.14em] text-primary",
                    align === "center" && "mx-auto w-fit"
                  )}
                >
                  {eyebrow}
                </p>
              ) : (
                <div className={cn("eyebrow mb-4", align === "center" && "mx-auto")}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {eyebrow}
                </div>
              )
            ) : null}
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.65rem] lg:leading-[1.12]">
              {title}
            </h2>
            {description ? (
              <p
                className={cn(
                  "text-pretty mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-8",
                  align === "center" && "mx-auto"
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        </Reveal>
        <Reveal delay={0.12} className="mt-8 md:mt-10 lg:mt-12">
          {children}
        </Reveal>
      </div>
    </section>
  );
}
