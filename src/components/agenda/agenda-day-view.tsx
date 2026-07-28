"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { formatTime, toDateKey } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { EmptyState } from "@/components/ui/page-chrome";
import { AppointmentDetailSheet } from "@/components/agenda/appointment-detail-sheet";
import {
  type CalendarAppointment,
  type CalendarDay,
  minutesToHm,
  parseHm,
  statusBadgeColors,
  statusLabels,
} from "@/components/agenda/agenda-shared";
import { CalendarDays } from "lucide-react";

type DaySlot =
  | { kind: "free"; startMinutes: number; endMinutes: number }
  | { kind: "appointment"; appointment: CalendarAppointment }
  | { kind: "now"; minutes: number };

function buildDaySlots(
  dayAppointments: CalendarAppointment[],
  openTime: string,
  closeTime: string,
  now: Date,
  dayKey: string
): DaySlot[] {
  const startMin = parseHm(openTime);
  const endMin = parseHm(closeTime);
  const sorted = [...dayAppointments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const slots: DaySlot[] = [];
  let cursor = startMin;

  for (const apt of sorted) {
    const aptStart = new Date(apt.scheduledAt);
    const aptStartMin = aptStart.getHours() * 60 + aptStart.getMinutes();
    const aptEndMin = aptStartMin + apt.duration;

    if (aptStartMin > cursor) {
      slots.push({ kind: "free", startMinutes: cursor, endMinutes: aptStartMin });
    }

    slots.push({ kind: "appointment", appointment: apt });
    cursor = Math.max(cursor, aptEndMin);
  }

  if (cursor < endMin) {
    slots.push({ kind: "free", startMinutes: cursor, endMinutes: endMin });
  }

  const isToday = toDateKey(now) === dayKey;
  if (isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= startMin && nowMin < endMin) {
      slots.push({ kind: "now", minutes: nowMin });
    }
  }

  return slots.sort((a, b) => {
    const pos = (s: DaySlot) => {
      if (s.kind === "appointment")
        return new Date(s.appointment.scheduledAt).getHours() * 60 +
          new Date(s.appointment.scheduledAt).getMinutes();
      if (s.kind === "free") return s.startMinutes;
      return s.minutes;
    };
    return pos(a) - pos(b);
  });
}

export function AgendaDayView({
  days,
  appointments,
  openTime = "07:00",
  closeTime = "22:00",
  barbers = [],
  canAccessComandas = false,
  onNewSlot,
  onReschedule,
  initialDate,
}: {
  days: CalendarDay[];
  appointments: CalendarAppointment[];
  openTime?: string;
  closeTime?: string;
  barbers?: { id: string; name: string }[];
  canAccessComandas?: boolean;
  onNewSlot?: (dateKey: string, time: string) => void;
  onReschedule?: (apt: CalendarAppointment) => void;
  initialDate?: string;
}) {
  const todayKey = toDateKey(new Date());
  const defaultSelected =
    initialDate && days.some((d) => d.date === initialDate)
      ? initialDate
      : days.find((d) => d.date === todayKey)?.date ?? days[0]?.date ?? todayKey;

  const [selectedDate, setSelectedDate] = useState(defaultSelected);
  const [barberFilter, setBarberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailApt, setDetailApt] = useState<CalendarAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const listRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const didScrollNow = useRef(false);

  const filtered = useMemo(
    () =>
      appointments.filter((a) => {
        if (barberFilter !== "all" && a.barberId !== barberFilter) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        return true;
      }),
    [appointments, barberFilter, statusFilter]
  );

  const dayAppointments = filtered.filter((a) => toDateKey(a.scheduledAt) === selectedDate);
  const slots = useMemo(
    () => buildDaySlots(dayAppointments, openTime, closeTime, now, selectedDate),
    [dayAppointments, openTime, closeTime, now, selectedDate]
  );

  const activeFilters = [
    barberFilter !== "all"
      ? { key: "barber", label: barbers.find((b) => b.id === barberFilter)?.name ?? "Profissional" }
      : null,
    statusFilter !== "all"
      ? { key: "status", label: statusLabels[statusFilter] ?? statusFilter }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (didScrollNow.current || !nowRef.current || selectedDate !== todayKey) return;
    didScrollNow.current = true;
    nowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedDate, todayKey, slots]);

  function goDay(delta: number) {
    const current = parseISO(selectedDate + "T12:00:00");
    const next = delta > 0 ? addDays(current, 1) : subDays(current, Math.abs(delta));
    const nextKey = toDateKey(next);
    const inWeek = days.some((d) => d.date === nextKey);
    setSelectedDate(inWeek ? nextKey : nextKey);
  }

  function clearFilters() {
    setBarberFilter("all");
    setStatusFilter("all");
  }

  const selectedDayLabel = format(parseISO(selectedDate + "T12:00:00"), "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });

  return (
    <div className="space-y-3">
      {/* Day navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={() => goDay(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold capitalize text-white">{selectedDayLabel}</p>
          <p className="text-xs text-zinc-500">
            {openTime} – {closeTime}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={() => goDay(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* 7-day strip */}
      <div className="flex gap-1 overflow-x-auto pb-1 touch-scroll">
        {days.map((day) => {
          const selected = day.date === selectedDate;
          const count = filtered.filter((a) => toDateKey(a.scheduledAt) === day.date).length;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelectedDate(day.date)}
              className={`flex min-w-[3rem] flex-col items-center rounded-xl px-2 py-2 transition-colors ${
                selected
                  ? "bg-amber-500 text-zinc-950"
                  : day.isToday
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase">
                {format(parseISO(day.date + "T12:00:00"), "EEE", { locale: ptBR })}
              </span>
              <span className="text-lg font-bold leading-none">
                {format(parseISO(day.date + "T12:00:00"), "d")}
              </span>
              {count > 0 && (
                <span
                  className={`mt-0.5 text-[10px] font-medium ${selected ? "text-zinc-800" : "text-zinc-500"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: Today + Filters */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-[40px]"
          onClick={() => setSelectedDate(todayKey)}
          disabled={selectedDate === todayKey}
        >
          Hoje
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-[40px] flex-1"
          onClick={() => setFilterOpen(true)}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilters.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-zinc-950">
              {activeFilters.length}
            </span>
          )}
        </Button>
        <span className="text-xs text-zinc-500">
          {dayAppointments.length} horário{dayAppointments.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
            >
              {f.label}
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-amber-400"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        </div>
      )}

      {/* Timeline */}
      <div
        ref={listRef}
        className="max-h-[min(60vh,560px)] space-y-2 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 touch-scroll"
      >
        {dayAppointments.length === 0 && (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="Nenhum horário neste dia"
            description="Toque em um horário livre abaixo ou crie um novo agendamento."
          />
        )}
        {slots.map((slot, i) => {
            if (slot.kind === "now") {
              return (
                <div
                  key="now"
                  ref={nowRef}
                  className="relative flex items-center gap-2 py-1"
                >
                  <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-rose-400">
                    {minutesToHm(slot.minutes)}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow" />
                    <div className="h-0.5 flex-1 bg-rose-500/90" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-rose-400">
                      Agora
                    </span>
                  </div>
                </div>
              );
            }

            if (slot.kind === "free") {
              const label = `${minutesToHm(slot.startMinutes)} – ${minutesToHm(slot.endMinutes)}`;
              return (
                <button
                  key={`free-${i}`}
                  type="button"
                  onClick={() =>
                    onNewSlot?.(selectedDate, minutesToHm(slot.startMinutes))
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-3 py-2.5 text-left transition-colors hover:border-amber-500/30 hover:bg-zinc-900/60"
                >
                  <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-600">
                    {minutesToHm(slot.startMinutes)}
                  </span>
                  <span className="text-sm text-zinc-600">Horário livre · {label}</span>
                </button>
              );
            }

            const apt = slot.appointment;
            const start = new Date(apt.scheduledAt);
            const badge =
              statusBadgeColors[apt.status] ?? statusBadgeColors.SCHEDULED;

            return (
              <button
                key={apt.id}
                type="button"
                onClick={() => setDetailApt(apt)}
                className="flex w-full gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-left transition-colors active:bg-zinc-800"
              >
                <div className="w-12 shrink-0">
                  <p className="text-sm font-bold tabular-nums text-amber-400">
                    {formatTime(start)}
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {apt.duration}m
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{apt.clientName}</p>
                  <p className="truncate text-sm text-zinc-400">{apt.serviceName}</p>
                  {apt.barberName && (
                    <p className="truncate text-xs text-zinc-500">{apt.barberName}</p>
                  )}
                </div>
                <span className={`shrink-0 self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${badge}`}>
                  {statusLabels[apt.status] ?? apt.status}
                </span>
              </button>
            );
          })}
      </div>

      {/* Filter sheet */}
      <ResponsiveDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtros"
        mobileVariant="sheet"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 min-h-[44px]" onClick={clearFilters}>
              Limpar
            </Button>
            <Button className="flex-1 min-h-[44px]" onClick={() => setFilterOpen(false)}>
              Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-400">Profissional</label>
            <select
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white"
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-400">Status</label>
            <select
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="NO_SHOW">Não compareceu</option>
            </select>
          </div>
        </div>
      </ResponsiveDialog>

      <AppointmentDetailSheet
        appointment={detailApt}
        open={detailApt !== null}
        onOpenChange={(v) => !v && setDetailApt(null)}
        canAccessComandas={canAccessComandas}
        onReschedule={onReschedule}
      />
    </div>
  );
}
