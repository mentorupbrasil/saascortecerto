"use client";

import { formatTime } from "@/lib/date-format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppointmentActions } from "@/components/appointments/appointment-components";

const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 44;

type CalendarAppointment = {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  clientName: string;
  serviceName: string;
  barberName?: string | null;
  bookedOnline?: boolean;
};

type CalendarDay = {
  date: string;
  label: string;
  isToday: boolean;
};

function getSlots() {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

function getTopPercent(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hours - START_HOUR) * 60 + minutes;
  const gridMinutes = (END_HOUR - START_HOUR) * 60;
  return Math.max(0, (totalMinutes / gridMinutes) * 100);
}

function getHeightPercent(duration: number) {
  const gridMinutes = (END_HOUR - START_HOUR) * 60;
  return (duration / gridMinutes) * 100;
}

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-zinc-700 border-zinc-500 text-white",
  CONFIRMED: "bg-blue-600/80 border-blue-400 text-white",
  COMPLETED: "bg-green-700/80 border-green-400 text-white",
  NO_SHOW: "bg-orange-700/80 border-orange-400 text-white",
};

export function AgendaCalendarGrid({
  days,
  appointments,
}: {
  days: CalendarDay[];
  appointments: CalendarAppointment[];
}) {
  const slots = getSlots();
  const gridHeight = slots.length * SLOT_HEIGHT;

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/30">
      <div className="min-w-[720px]">
        {/* Header dias */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-zinc-800 bg-zinc-950 sticky top-0 z-20">
          <div className="p-2" />
          {days.map((day) => (
            <div
              key={day.date}
              className={`border-l border-zinc-800 p-2 text-center ${
                day.isToday ? "bg-amber-500/10" : ""
              }`}
            >
              <p
                className={`text-xs uppercase ${
                  day.isToday ? "text-amber-400" : "text-zinc-500"
                }`}
              >
                {format(new Date(day.date), "EEE", { locale: ptBR })}
              </p>
              <p
                className={`text-lg font-bold ${
                  day.isToday ? "text-amber-400" : "text-white"
                }`}
              >
                {format(new Date(day.date), "d")}
              </p>
            </div>
          ))}
        </div>

        {/* Grid horários */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Coluna horas */}
          <div className="relative" style={{ height: gridHeight }}>
            {slots.map((slot, i) => (
              <div
                key={slot}
                className="absolute right-2 text-[10px] text-zinc-600 tabular-nums -translate-y-2"
                style={{ top: i * SLOT_HEIGHT }}
              >
                {slot.endsWith(":00") ? slot : ""}
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {days.map((day) => {
            const dayApts = appointments.filter((a) => {
              const aptDate = new Date(a.scheduledAt);
              const colDate = new Date(day.date);
              return (
                aptDate.getFullYear() === colDate.getFullYear() &&
                aptDate.getMonth() === colDate.getMonth() &&
                aptDate.getDate() === colDate.getDate()
              );
            });

            return (
              <div
                key={day.date}
                className={`relative border-l border-zinc-800 ${
                  day.isToday ? "bg-amber-500/[0.03]" : ""
                }`}
                style={{ height: gridHeight }}
              >
                {/* Linhas horizontais */}
                {slots.map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-zinc-800/60"
                    style={{ top: i * SLOT_HEIGHT }}
                  />
                ))}

                {/* Eventos */}
                {dayApts.map((apt) => {
                  const start = new Date(apt.scheduledAt);
                  const top = getTopPercent(start);
                  const height = getHeightPercent(apt.duration);
                  const color =
                    statusColors[apt.status] ?? statusColors.SCHEDULED;

                  return (
                    <div
                      key={apt.id}
                      className={`absolute left-0.5 right-0.5 rounded-md border-l-4 px-1.5 py-1 overflow-hidden z-10 ${color}`}
                      style={{
                        top: `${top}%`,
                        height: `${Math.max(height, 4)}%`,
                        minHeight: 28,
                      }}
                    >
                      <p className="text-[10px] font-bold truncate">
                        {formatTime(start)} · {apt.clientName}
                        {apt.bookedOnline && (
                          <span className="ml-1 opacity-70" title="Agendou online">
                            🌐
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] opacity-80 truncate">
                        {apt.serviceName}
                      </p>
                      <div className="mt-0.5">
                        <AppointmentActions id={apt.id} status={apt.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
