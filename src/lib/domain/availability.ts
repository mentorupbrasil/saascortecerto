/**
 * Central availability domain — used by internal agenda, public booking,
 * reschedule, WhatsApp assistant, and waitlist.
 */

import { addMinutes } from "date-fns";
import {
  getTenantTimezone,
  parseHmToMinutes,
  wallTimeToUtc,
  zonedParts,
} from "@/lib/timezone";

export type OccupancyBlock = {
  scheduledAt: Date;
  duration: number;
  barberId?: string | null;
  status?: string;
  kind?: "appointment" | "checkout" | "time_off" | "break";
};

export type AvailabilityInput = {
  date: Date;
  timeZone?: string | null;
  openTime: string;
  closeTime: string;
  workingDays: string; // "1,2,3,4,5,6"
  serviceDuration: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  occupancy: OccupancyBlock[];
  barberId?: string | null;
  barberIds?: string[];
  slotStepMinutes?: number;
  now?: Date;
};

export function parseWorkingDays(workingDays: string): number[] {
  return workingDays
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export function intervalsOverlap(
  aStart: Date,
  aDuration: number,
  bStart: Date,
  bDuration: number,
  bufferBefore = 0,
  bufferAfter = 0
) {
  const a0 = addMinutes(aStart, -bufferBefore).getTime();
  const a1 = addMinutes(aStart, aDuration + bufferAfter).getTime();
  const b0 = bStart.getTime();
  const b1 = addMinutes(bStart, bDuration).getTime();
  return a0 < b1 && a1 > b0;
}

function isActiveOccupancy(block: OccupancyBlock) {
  if (!block.status) return true;
  return block.status !== "CANCELLED" && block.status !== "EXPIRED";
}

export function hasConflict(options: {
  start: Date;
  duration: number;
  barberId?: string | null;
  occupancy: OccupancyBlock[];
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}) {
  const {
    start,
    duration,
    barberId,
    occupancy,
    bufferBeforeMinutes = 0,
    bufferAfterMinutes = 0,
  } = options;

  return occupancy.filter(isActiveOccupancy).some((block) => {
    if (barberId && block.barberId && block.barberId !== barberId) return false;
    if (barberId && !block.barberId && block.kind === "appointment") {
      // unassigned appointments still occupy generic capacity if no barber filter match
    }
    return intervalsOverlap(
      start,
      duration,
      block.scheduledAt,
      block.duration,
      bufferBeforeMinutes,
      bufferAfterMinutes
    );
  });
}

export function getAvailableSlots(input: AvailabilityInput): string[] {
  const timeZone = getTenantTimezone(input.timeZone);
  const parts = zonedParts(input.date, timeZone);
  const weekdays = parseWorkingDays(input.workingDays);
  if (!weekdays.includes(parts.weekday)) return [];

  const step = input.slotStepMinutes ?? 30;
  const openMin = parseHmToMinutes(input.openTime);
  const closeMin = parseHmToMinutes(input.closeTime);
  const now = input.now ?? new Date();
  const slots: string[] = [];

  for (let minute = openMin; minute + input.serviceDuration <= closeMin; minute += step) {
    const hh = String(Math.floor(minute / 60)).padStart(2, "0");
    const mm = String(minute % 60).padStart(2, "0");
    const slotStart = wallTimeToUtc(parts.dateKey, `${hh}:${mm}`, timeZone);

    if (slotStart.getTime() < now.getTime()) continue;

    const barberId = input.barberId || null;
    const barberIds = input.barberIds ?? [];

    let free = false;
    if (barberId) {
      free = !hasConflict({
        start: slotStart,
        duration: input.serviceDuration,
        barberId,
        occupancy: input.occupancy,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
      });
    } else if (barberIds.length > 0) {
      free = barberIds.some(
        (id) =>
          !hasConflict({
            start: slotStart,
            duration: input.serviceDuration,
            barberId: id,
            occupancy: input.occupancy,
            bufferBeforeMinutes: input.bufferBeforeMinutes,
            bufferAfterMinutes: input.bufferAfterMinutes,
          })
      );
    } else {
      free = !hasConflict({
        start: slotStart,
        duration: input.serviceDuration,
        occupancy: input.occupancy,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
      });
    }

    if (free) slots.push(slotStart.toISOString());
  }

  return slots;
}

export function formatSlotLabel(iso: string, timeZone?: string) {
  const tz = getTenantTimezone(timeZone);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
