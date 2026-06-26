import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatTime(date: Date | string) {
  return format(new Date(date), "HH:mm", { locale: ptBR });
}

export function formatDateLong(date: Date | string) {
  return format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR });
}
