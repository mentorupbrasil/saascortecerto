"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, toDateKey } from "@/lib/date-format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendaDayView } from "@/components/agenda/agenda-day-view";
import {
  type CalendarAppointment,
  type CalendarDay,
  getHourLabels,
  parseHm,
  statusColors,
  statusLabels,
} from "@/components/agenda/agenda-shared";

/** Pixels per hour — keeps 07:00–22:00 readable without endless scroll */
const HOUR_HEIGHT = 52;
const GUTTER_WIDTH = 64;

export type { CalendarAppointment, CalendarDay };

export function AgendaCalendarGrid({
  days,
  appointments,
  openTime = "07:00",
  closeTime = "22:00",
  barbers = [],
  canAccessComandas = false,
  initialDate,
  onNewSlot,
  onReschedule,
}: {
  days: CalendarDay[];
  appointments: CalendarAppointment[];
  openTime?: string;
  closeTime?: string;
  barbers?: { id: string; name: string }[];
  canAccessComandas?: boolean;
  initialDate?: string;
  onNewSlot?: (dateKey: string, time: string) => void;
  onReschedule?: (apt: CalendarAppointment) => void;
}) {
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  const startMinutes = parseHm(openTime);
  const endMinutes = parseHm(closeTime);
  const totalMinutes = Math.max(endMinutes - startMinutes, 60);
  const gridHeight = (totalMinutes / 60) * HOUR_HEIGHT;
  const pxPerMinute = HOUR_HEIGHT / 60;
  const hourLabels = useMemo(
    () => getHourLabels(openTime, closeTime),
    [openTime, closeTime]
  );

  const filtered = appointments.filter((a) => {
    if (barberFilter !== "all" && a.barberId !== barberFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const todayKey = toDateKey(now);
  const showsToday = days.some((d) => d.date === todayKey);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowInRange =
    showsToday && nowMinutes >= startMinutes && nowMinutes < endMinutes;
  const nowTop = (nowMinutes - startMinutes) * pxPerMinute;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (didScroll.current || !scrollRef.current || !nowInRange) return;
    didScroll.current = true;
    const target = Math.max(0, nowTop - 80);
    scrollRef.current.scrollTop = target;
  }, [nowInRange, nowTop]);

  function topPx(date: Date) {
    const total = date.getHours() * 60 + date.getMinutes() - startMinutes;
    return Math.max(0, total * pxPerMinute);
  }

  function heightPx(duration: number) {
    return Math.max(duration * pxPerMinute, 28);
  }

  return (
    <div className="relative space-y-3">
      {/* Mobile day view */}
      <div className="lg:hidden">
        <AgendaDayView
          days={days}
          appointments={appointments}
          openTime={openTime}
          closeTime={closeTime}
          barbers={barbers}
          canAccessComandas={canAccessComandas}
          onNewSlot={onNewSlot}
          onReschedule={onReschedule}
          initialDate={initialDate}
        />
      </div>

      {/* Desktop weekly grid */}
      <div className="hidden lg:block space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filtrar por profissional"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-foreground"
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
            >
              <option value="all">Todos os profissionais</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por status"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-foreground"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="NO_SHOW">Não compareceu</option>
            </select>
          </div>
          <p className="text-sm text-zinc-400">
            Horário da barbearia:{" "}
            <span className="font-medium text-zinc-200">
              {openTime} – {closeTime}
            </span>
            <span className="mx-2 text-zinc-700">·</span>
            {filtered.length === 0
              ? "Nenhum horário nesta semana"
              : `${filtered.length} agendamento${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
          {Object.entries(statusLabels).map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-sm border-l-2 ${statusColors[key]}`}
              />
              {label}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
          <div
            ref={scrollRef}
            className="max-h-[min(70vh,720px)] overflow-auto touch-scroll"
          >
            <div className="min-w-[780px]">
              <div
                className="sticky top-0 z-30 grid border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"
                style={{
                  gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))`,
                }}
              >
                <div className="flex items-end justify-end p-2 pb-3 pr-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Hora
                  </span>
                </div>
                {days.map((day) => (
                  <div
                    key={day.date}
                    className={`border-l border-zinc-800 px-2 py-2.5 text-center ${
                      day.isToday ? "bg-amber-500/10" : ""
                    }`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        day.isToday ? "text-amber-400" : "text-zinc-500"
                      }`}
                    >
                      {format(new Date(day.date + "T12:00:00"), "EEE", {
                        locale: ptBR,
                      })}
                    </p>
                    <p
                      className={`mt-0.5 text-xl font-bold leading-none ${
                        day.isToday ? "text-amber-400" : "text-foreground"
                      }`}
                    >
                      {format(new Date(day.date + "T12:00:00"), "d")}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))`,
                  height: gridHeight,
                }}
              >
                <div className="relative border-r border-zinc-800 bg-zinc-950/40">
                  {hourLabels.map((hour) => {
                    const top = (hour * 60 - startMinutes) * pxPerMinute;
                    const label = `${String(hour).padStart(2, "0")}:00`;
                    return (
                      <div
                        key={hour}
                        className="absolute right-0 left-0 pr-2.5 text-right"
                        style={{ top: Math.max(top + 2, 2) }}
                      >
                        <span className="text-xs font-semibold tabular-nums text-zinc-300">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {days.map((day) => {
                  const dayApts = filtered.filter(
                    (a) => toDateKey(a.scheduledAt) === day.date
                  );

                  return (
                    <div
                      key={day.date}
                      className={`relative border-l border-zinc-800/80 ${
                        day.isToday ? "bg-amber-500/[0.04]" : "bg-zinc-900/20"
                      }`}
                    >
                      {hourLabels.map((hour) => {
                        const top = (hour * 60 - startMinutes) * pxPerMinute;
                        const halfTop = top + HOUR_HEIGHT / 2;
                        return (
                          <div key={hour}>
                            <div
                              className="absolute inset-x-0 border-t border-zinc-700/70"
                              style={{ top }}
                            />
                            <div
                              className="absolute inset-x-0 border-t border-dashed border-zinc-800/80"
                              style={{ top: halfTop }}
                            />
                          </div>
                        );
                      })}

                      {dayApts.map((apt) => {
                        const start = new Date(apt.scheduledAt);
                        const top = topPx(start);
                        const height = heightPx(apt.duration);
                        const color =
                          statusColors[apt.status] ?? statusColors.SCHEDULED;

                        return (
                          <div
                            key={apt.id}
                            title={`${formatTime(start)} · ${apt.clientName} · ${apt.serviceName}`}
                            className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 shadow-sm ${color}`}
                            style={{ top, height }}
                          >
                            <p className="truncate text-[11px] font-bold leading-tight">
                              {formatTime(start)} · {apt.clientName}
                            </p>
                            <p className="truncate text-[10px] leading-tight opacity-85">
                              {apt.serviceName}
                              {apt.barberName ? ` · ${apt.barberName}` : ""}
                              {apt.bookedOnline ? " · online" : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {nowInRange && (
                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      top: nowTop,
                      left: GUTTER_WIDTH,
                      right: 0,
                    }}
                  >
                    <div className="relative">
                      <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-rose-500 shadow" />
                      <div className="h-0.5 w-full bg-rose-500/90" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="border-t border-zinc-800 px-4 py-3 text-center text-sm text-zinc-500">
              Sem agendamentos nesta semana — use{" "}
              <span className="text-zinc-300">Novo horário</span> para criar o
              primeiro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
