"use client";

import { useCallback, useState } from "react";
import { AgendaCalendarGrid } from "@/components/agenda/agenda-calendar-grid";
import {
  NewAppointmentModal,
  type ReschedulePrefill,
} from "@/components/appointments/appointment-components";
import type { CalendarAppointment, CalendarDay } from "@/components/agenda/agenda-shared";

type Service = {
  id: string;
  name: string;
  price: string | number | { toString(): string };
  duration: number;
};
type Barber = { id: string; name: string };

export function AgendaSection({
  days,
  appointments,
  openTime,
  closeTime,
  barbers,
  services,
  canAccessComandas,
  initialDate,
}: {
  days: CalendarDay[];
  appointments: CalendarAppointment[];
  openTime: string;
  closeTime: string;
  barbers: Barber[];
  services: Service[];
  canAccessComandas: boolean;
  initialDate?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultDateTime, setDefaultDateTime] = useState<string | undefined>();
  const [reschedulePrefill, setReschedulePrefill] = useState<ReschedulePrefill | undefined>();

  const handleNewSlot = useCallback((dateKey: string, time: string) => {
    setReschedulePrefill(undefined);
    setDefaultDateTime(`${dateKey}T${time}`);
    setModalOpen(true);
  }, []);

  const handleReschedule = useCallback((apt: CalendarAppointment) => {
    setReschedulePrefill({
      clientName: apt.clientName,
      clientPhone: apt.clientPhone ?? "",
      serviceId: apt.serviceId,
      barberId: apt.barberId ?? undefined,
      notes: apt.notes ?? undefined,
    });
    setDefaultDateTime(undefined);
    setModalOpen(true);
  }, []);

  return (
    <>
      <AgendaCalendarGrid
        days={days}
        appointments={appointments}
        openTime={openTime}
        closeTime={closeTime}
        barbers={barbers}
        canAccessComandas={canAccessComandas}
        initialDate={initialDate}
        onNewSlot={handleNewSlot}
        onReschedule={handleReschedule}
      />

      <NewAppointmentModal
        services={services}
        barbers={barbers}
        defaultDate={defaultDateTime}
        prefill={reschedulePrefill}
        open={modalOpen}
        onOpenChange={setModalOpen}
        hideTrigger
      />
    </>
  );
}
