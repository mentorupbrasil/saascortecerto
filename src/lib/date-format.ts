import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Chave yyyy-MM-dd no fuso local — evita bug de dia errado com toISOString(). */
export function toDateKey(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatTime(date: Date | string) {
  return format(new Date(date), "HH:mm", { locale: ptBR });
}

export function formatDateLong(date: Date | string) {
  return format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR });
}
