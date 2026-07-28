"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Calendar,
  ShoppingCart,
  Pencil,
  Crown,
  Clock,
  Scissors,
} from "lucide-react";
import { ClientAvatar, ClientFormModal } from "@/components/clients/client-form";
import { ClientScheduleModal } from "@/components/clients/client-schedule-modal";
import { PageHeader, FixedActionBar } from "@/components/ui/page-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatPhone, formatCurrency } from "@/lib/utils";
import { isClientOverdue } from "@/lib/client-utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { createComandaAction } from "@/lib/finance-actions";
import { serializeClientForForm } from "@/lib/serialize";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AppointmentStatus, SaleStatus } from "@prisma/client";

const APPT_STATUS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const SALE_STATUS: Record<SaleStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  CANCELLED: "Cancelada",
};

export type ClientDetailData = {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
  notes: string | null;
  lastVisitAt: string | null;
  returnDays: number;
  photoUrl: string | null;
  whatsappOptIn: boolean;
  isClubMember: boolean;
  clubPlanName: string | null;
  appointments: {
    id: string;
    scheduledAt: string;
    status: AppointmentStatus;
    serviceName: string;
    barberName: string | null;
    price: number;
  }[];
  sales: {
    id: string;
    status: SaleStatus;
    total: number;
    createdAt: string;
    itemCount: number;
  }[];
};

type ClientDetailViewProps = {
  client: ClientDetailData;
  services: { id: string; name: string; price: number; duration: number }[];
  barbers: { id: string; name: string }[];
  permissions: {
    canManage: boolean;
    canSchedule: boolean;
    canSell: boolean;
    canViewFinance: boolean;
  };
};

export function ClientDetailView({
  client,
  services,
  barbers,
  permissions,
}: ClientDetailViewProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const overdue = isClientOverdue(client.lastVisitAt, client.returnDays);
  const waUrl = buildWhatsAppUrl(client.phone, `Olá ${client.name}!`);

  function openComanda() {
    startTransition(async () => {
      try {
        await createComandaAction({ clientId: client.id });
        toast.success("Comanda aberta");
        router.push("/comandas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao abrir comanda");
      }
    });
  }

  return (
    <div className="animate-fade-in space-y-6 pb-28 lg:pb-6">
      <Link
        href="/clientes"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para clientes
      </Link>

      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            {client.isClubMember && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">
                <Crown className="h-3.5 w-3.5" />
                Clube
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-400">
                <Clock className="h-3.5 w-3.5" />
                Retorno atrasado
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{formatPhone(client.phone)}</p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="Última visita"
          value={
            client.lastVisitAt
              ? format(new Date(client.lastVisitAt), "dd/MM/yyyy", { locale: ptBR })
              : "Sem registro"
          }
        />
        <InfoCard label="Retorno" value={`${client.returnDays} dias`} />
        <InfoCard
          label="Clube"
          value={client.isClubMember ? (client.clubPlanName ?? "Ativo") : "Não membro"}
        />
        <InfoCard
          label="Aniversário"
          value={
            client.birthday
              ? format(new Date(client.birthday), "dd/MM", { locale: ptBR })
              : "—"
          }
        />
      </div>

      {client.notes && (
        <Card>
          <p className="text-sm font-medium text-muted-foreground">Observações</p>
          <p className="mt-2 text-sm text-foreground">{client.notes}</p>
        </Card>
      )}

      <section className="space-y-3">
        <PageHeader
          title="Histórico de agendamentos"
          description={`${client.appointments.length} registro(s)`}
        />
        {client.appointments.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum agendamento registrado
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {client.appointments.map((appt) => (
              <Card key={appt.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{appt.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appt.scheduledAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                      {appt.barberName ? ` · ${appt.barberName}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {APPT_STATUS[appt.status]}
                    </span>
                    <p className="mt-1 text-sm text-amber-400">{formatCurrency(appt.price)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {permissions.canViewFinance && client.sales.length > 0 && (
        <section className="space-y-3">
          <PageHeader
            title="Histórico de comandas"
            description={`${client.sales.length} registro(s)`}
          />
          <div className="space-y-2">
            {client.sales.map((sale) => (
              <Link key={sale.id} href="/comandas" className="block">
                <Card hover className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{formatCurrency(sale.total)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {" · "}
                        {sale.itemCount} item(ns)
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {SALE_STATUS[sale.status]}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="hidden flex-wrap gap-2 lg:flex">
        {permissions.canManage && (
          <ClientFormModal
            client={serializeClientForForm({
              ...client,
              birthday: client.birthday ? new Date(client.birthday) : null,
            })}
            edit
          />
        )}
        {permissions.canSchedule && (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            onClick={() => setScheduleOpen(true)}
          >
            <Calendar className="h-4 w-4" />
            Agendar
          </Button>
        )}
        {permissions.canSell && (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            disabled={pending}
            onClick={openComanda}
          >
            <ShoppingCart className="h-4 w-4" />
            Abrir comanda
          </Button>
        )}
      </div>

      <FixedActionBar className="lg:hidden">
        {permissions.canManage && (
          <ClientFormModal
            className="flex-1"
            client={serializeClientForForm({
              ...client,
              birthday: client.birthday ? new Date(client.birthday) : null,
            })}
            edit
            trigger={
              <Button variant="secondary" className="w-full min-h-[44px]">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            }
          />
        )}
        {permissions.canSchedule && (
          <Button
            variant="secondary"
            className="min-h-[44px] flex-1"
            onClick={() => setScheduleOpen(true)}
          >
            <Scissors className="h-4 w-4" />
            Agendar
          </Button>
        )}
        {permissions.canSell && (
          <Button
            className="min-h-[44px] flex-1"
            disabled={pending}
            onClick={openComanda}
          >
            <ShoppingCart className="h-4 w-4" />
            Comanda
          </Button>
        )}
      </FixedActionBar>

      {permissions.canSchedule && (
        <ClientScheduleModal
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          clientName={client.name}
          clientPhone={client.phone}
          services={services}
          barbers={barbers}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </Card>
  );
}
