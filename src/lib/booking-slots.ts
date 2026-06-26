import {
  addMinutes,
  setHours,
  setMinutes,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";

export function parseWorkingDays(workingDays: string): number[] {
  return workingDays.split(",").map((d) => parseInt(d.trim(), 10));
}

export function parseTimeString(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { hours: h ?? 8, minutes: m ?? 0 };
}

export function isWorkingDay(date: Date, workingDays: string) {
  return parseWorkingDays(workingDays).includes(date.getDay());
}

type ExistingAppointment = {
  scheduledAt: Date;
  duration: number;
  barberId?: string | null;
};

function overlaps(
  slotStart: Date,
  duration: number,
  aptStart: Date,
  aptDuration: number
) {
  const slotEnd = addMinutes(slotStart, duration);
  const aptEnd = addMinutes(aptStart, aptDuration);
  return slotStart < aptEnd && slotEnd > aptStart;
}

export function getAvailableSlots(options: {
  date: Date;
  openTime: string;
  closeTime: string;
  workingDays: string;
  serviceDuration: number;
  appointments: ExistingAppointment[];
  barberId?: string | null;
  barberIds?: string[];
  slotStepMinutes?: number;
}) {
  const {
    date,
    openTime,
    closeTime,
    workingDays,
    serviceDuration,
    appointments,
    barberId,
    barberIds = [],
    slotStepMinutes = 30,
  } = options;

  if (!isWorkingDay(date, workingDays)) return [];

  const open = parseTimeString(openTime);
  const close = parseTimeString(closeTime);
  let cursor = setMinutes(setHours(startOfDay(date), open.hours), open.minutes);
  const dayEnd = setMinutes(setHours(startOfDay(date), close.hours), close.minutes);
  const now = new Date();

  const slots: string[] = [];

  while (addMinutes(cursor, serviceDuration) <= dayEnd) {
    const slotEnd = addMinutes(cursor, serviceDuration);
    if (isAfter(cursor, dayEnd)) break;

    if (isBefore(cursor, now) && startOfDay(cursor).getTime() === startOfDay(now).getTime()) {
      cursor = addMinutes(cursor, slotStepMinutes);
      continue;
    }

    const relevantApts = appointments.filter((apt) => {
      if (barberId) return apt.barberId === barberId;
      if (barberIds.length > 0 && apt.barberId) {
        return barberIds.includes(apt.barberId);
      }
      return true;
    });

    let isFree = false;

    if (barberId) {
      isFree = !relevantApts.some((apt) =>
        overlaps(cursor, serviceDuration, apt.scheduledAt, apt.duration)
      );
    } else if (barberIds.length > 0) {
      isFree = barberIds.some((id) => {
        const barberApts = appointments.filter((a) => a.barberId === id);
        return !barberApts.some((apt) =>
          overlaps(cursor, serviceDuration, apt.scheduledAt, apt.duration)
        );
      });
    } else {
      isFree = !appointments.some((apt) =>
        overlaps(cursor, serviceDuration, apt.scheduledAt, apt.duration)
      );
    }

    if (isFree) {
      slots.push(cursor.toISOString());
    }

    cursor = addMinutes(cursor, slotStepMinutes);
  }

  return slots;
}

export function formatSlotLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
