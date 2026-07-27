/**
 * Tenant timezone helpers using Intl (no extra dependency).
 * Default: America/Sao_Paulo
 */

export const DEFAULT_TENANT_TIMEZONE = "America/Sao_Paulo";

export function getTenantTimezone(timeZone?: string | null): string {
  return timeZone?.trim() || DEFAULT_TENANT_TIMEZONE;
}

export function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const bags = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(bags.year),
    month: Number(bags.month),
    day: Number(bags.day),
    hours: Number(bags.hour),
    minutes: Number(bags.minute),
    seconds: Number(bags.second),
    weekday: weekdayMap[bags.weekday ?? "Mon"] ?? 1,
    dateKey: `${bags.year}-${bags.month}-${bags.day}`,
    timeKey: `${bags.hour}:${bags.minute}`,
  };
}

export function zonedParts(date: Date, timeZone: string) {
  return partsInTz(date, timeZone);
}

/**
 * Convert a wall-clock date+time in a timezone to a UTC Date.
 * Uses iterative offset resolution (handles DST).
 */
export function wallTimeToUtc(
  dateKey: string,
  hm: string,
  timeZone: string
): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  // First guess: treat as UTC
  let utc = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  for (let i = 0; i < 3; i++) {
    const p = partsInTz(new Date(utc), timeZone);
    const asWanted = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
    const asGot = Date.UTC(p.year, p.month - 1, p.day, p.hours, p.minutes, p.seconds, 0);
    utc += asWanted - asGot;
  }
  return new Date(utc);
}

export function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return wallTimeToUtc(p.dateKey, "00:00", timeZone);
}

export function endOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  const next = wallTimeToUtc(p.dateKey, "00:00", timeZone);
  return new Date(next.getTime() + 24 * 60 * 60 * 1000);
}

export function formatInTenantTz(
  date: Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  }).format(date);
}
