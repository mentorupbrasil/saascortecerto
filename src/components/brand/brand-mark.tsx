import Image from "next/image";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

/** Native PNG dimensions from GestorPro — keep sharpness when scaling. */
const LOGO_INTRINSIC = { width: 609, height: 693 } as const;

const SYMBOL_SRC = brand.logos.symbol;

/**
 * Official GestorPro symbol (gestorpro-symbol.png).
 * Do not replace with a generated mark.
 */
export function LogoMark({
  size = 26,
  className,
  priority,
  title = brand.parentName,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  title?: string;
}) {
  return (
    <Image
      src={SYMBOL_SRC}
      alt={title}
      width={LOGO_INTRINSIC.width}
      height={LOGO_INTRINSIC.height}
      className={cn("w-auto shrink-0 object-contain", className)}
      style={{ height: size, width: "auto" }}
      priority={priority}
    />
  );
}

/** @deprecated Prefer LogoMark — kept so existing imports keep working. */
export function BrandMark({
  className,
  title = brand.parentName,
  size,
}: {
  className?: string;
  title?: string;
  /** Pixel height; inferred from Tailwind h-* when omitted */
  size?: number;
}) {
  // Map common className sizes; default 36
  const inferred =
    size ??
    (className?.includes("h-16")
      ? 64
      : className?.includes("h-14")
        ? 56
        : className?.includes("h-10")
          ? 40
          : className?.includes("h-9")
            ? 36
            : 36);

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <LogoMark size={inferred} title={title} />
    </span>
  );
}

/** Horizontal wordmark: Gestor + Pro (Pro in institutional green). */
export function GestorProText({
  light = false,
  className,
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-base font-bold tracking-tight",
        light ? "text-white" : "text-foreground",
        className
      )}
    >
      {brand.parentNameGestor}
      <span className={light ? "text-primary" : "text-primary"}>{brand.parentNamePro}</span>
    </span>
  );
}

/** Official lockup: [symbol] GestorPro */
export function GestorProLockup({
  size = 26,
  light = false,
  textClassName,
  className,
  priority,
}: {
  size?: number;
  light?: boolean;
  textClassName?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} priority={priority} />
      <GestorProText light={light} className={textClassName} />
    </span>
  );
}

/**
 * Product lockup for Cortzo:
 *   [symbol] Cortzo
 *            by GestorPro
 */
export function CortzoLockup({
  size = 32,
  className,
  productClassName,
  bylineClassName,
  priority,
  stacked = true,
}: {
  size?: number;
  className?: string;
  productClassName?: string;
  bylineClassName?: string;
  priority?: boolean;
  /** When false, shows a compact single-line product name only (symbol + Cortzo) */
  stacked?: boolean;
}) {
  if (!stacked) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <LogoMark size={size} priority={priority} />
        <span
          className={cn(
            "text-base font-bold tracking-tight text-foreground",
            productClassName
          )}
        >
          {brand.name}
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} priority={priority} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block text-base font-bold tracking-tight text-foreground",
            productClassName
          )}
        >
          {brand.name}
        </span>
        <span
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10px] font-medium tracking-wide text-zinc-500",
            bylineClassName
          )}
        >
          by{" "}
          <span className="font-semibold text-foreground/80">
            {brand.parentNameGestor}
            <span className="text-primary">{brand.parentNamePro}</span>
          </span>
        </span>
      </span>
    </span>
  );
}

/** Compact institutional signature line: by GestorPro (with small symbol). */
export function ByGestorPro({
  className,
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-zinc-500", className)}>
      <LogoMark size={size} />
      <span>
        by{" "}
        <span className="font-semibold text-foreground/80">
          {brand.parentNameGestor}
          <span className="text-primary">{brand.parentNamePro}</span>
        </span>
      </span>
    </span>
  );
}

/** Plain text wordmark for rare cases without the symbol. */
export function BrandWordmark({
  className,
  as: Tag = "span",
}: {
  className?: string;
  as?: "span" | "h1" | "p";
}) {
  return (
    <Tag className={cn("font-semibold tracking-tight text-foreground", className)}>
      {brand.name}
    </Tag>
  );
}
