export type CalendarAppointment = {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  clientName: string;
  clientPhone?: string;
  clientId?: string;
  serviceId?: string;
  serviceName: string;
  barberId?: string | null;
  barberName?: string | null;
  bookedOnline?: boolean;
  notes?: string | null;
  origin?: string | null;
  paymentMethod?: string | null;
  saleId?: string | null;
};

export type CalendarDay = {
  date: string;
  label: string;
  isToday: boolean;
};

export const statusColors: Record<string, string> = {
  SCHEDULED: "bg-zinc-700/95 border-zinc-400 text-foreground",
  CONFIRMED: "bg-blue-600/90 border-blue-300 text-foreground",
  COMPLETED: "bg-green-700/90 border-green-300 text-foreground",
  NO_SHOW: "bg-orange-700/90 border-orange-300 text-foreground",
  CANCELLED: "bg-red-900/60 border-red-600 text-zinc-300",
};

export const statusBadgeColors: Record<string, string> = {
  SCHEDULED: "bg-zinc-700/60 text-zinc-200",
  CONFIRMED: "bg-blue-600/30 text-blue-300",
  COMPLETED: "bg-green-700/40 text-green-300",
  NO_SHOW: "bg-orange-700/40 text-orange-300",
  CANCELLED: "bg-red-900/40 text-red-300",
};

export const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  NO_SHOW: "Faltou",
  CANCELLED: "Cancelado",
};

export const originLabels: Record<string, string> = {
  INTERNAL: "Interno",
  PUBLIC: "Online",
  WALK_IN: "Balcão",
  WHATSAPP: "WhatsApp",
  WAITLIST: "Lista de espera",
  RECURRING: "Recorrente",
};

export const paymentLabels: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CARD: "Cartão",
};

export function parseHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 7) * 60 + (m ?? 0);
}

export function getHourLabels(openTime: string, closeTime: string) {
  const start = parseHm(openTime);
  const end = parseHm(closeTime);
  const hours: number[] = [];
  for (let m = start; m < end; m += 60) {
    hours.push(Math.floor(m / 60));
  }
  return hours;
}

export function minutesToHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
