/**
 * Monetary values are stored as integer cents (BRL) in application logic.
 * Prisma Decimal(12,2) stores major units; convert at boundaries.
 */

export type MoneyCents = number & { readonly __brand: "MoneyCents" };

export function toCents(value: number | string): MoneyCents {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) throw new Error("Valor monetário inválido");
  return Math.round(n * 100) as MoneyCents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatBRLFromCents(cents: number): string {
  return formatBRL(fromCents(cents));
}

export function addCents(...values: number[]): MoneyCents {
  return values.reduce((a, b) => a + b, 0) as MoneyCents;
}

export function percentOfCents(cents: number, percent: number): MoneyCents {
  // Half-up rounding in cents
  return Math.round((cents * percent) / 100) as MoneyCents;
}
