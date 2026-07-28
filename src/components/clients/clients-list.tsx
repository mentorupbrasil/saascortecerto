"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Crown,
  Clock,
  Calendar,
  MessageCircle,
  ShoppingCart,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { ClientAvatar, ClientFormModal } from "@/components/clients/client-form";
import { ClientScheduleModal } from "@/components/clients/client-schedule-modal";
import { PageHeader, EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatPhone } from "@/lib/utils";
import { isClientOverdue, buildWhatsAppUrl } from "@/lib/client-utils";
import { createComandaAction } from "@/lib/finance-actions";
import { serializeClientForForm } from "@/lib/serialize";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ClientListItem = {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
  notes: string | null;
  lastVisitAt: string | null;
  returnDays: number;
  photoUrl: string | null;
  whatsappOptIn: boolean;
  appointmentCount: number;
  isClubMember: boolean;
};

type ClientsListProps = {
  clients: ClientListItem[];
  services: { id: string; name: string; price: number; duration: number }[];
  barbers: { id: string; name: string }[];
  permissions: {
    canManage: boolean;
    canSchedule: boolean;
    canSell: boolean;
  };
};

type FilterKey = "club" | "overdue" | "lastVisit";

export function ClientsList({
  clients,
  services,
  barbers,
  permissions,
}: ClientsListProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    club: false,
    overdue: false,
    lastVisit: false,
  });
  const [scheduleClient, setScheduleClient] = useState<ClientListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");

    let list = clients.filter((c) => {
      if (!q) return true;
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = digits.length > 0 && c.phone.includes(digits);
      return nameMatch || phoneMatch;
    });

    if (filters.club) {
      list = list.filter((c) => c.isClubMember);
    }
    if (filters.overdue) {
      list = list.filter((c) => isClientOverdue(c.lastVisitAt, c.returnDays));
    }
    if (filters.lastVisit) {
      list = [...list].sort((a, b) => {
        if (!a.lastVisitAt && !b.lastVisitAt) return 0;
        if (!a.lastVisitAt) return 1;
        if (!b.lastVisitAt) return -1;
        return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime();
      });
    }

    return list;
  }, [clients, search, filters]);

  function toggleFilter(key: FilterKey) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openWhatsApp(client: ClientListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = buildWhatsAppUrl(client.phone, `Olá ${client.name}!`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleSchedule(client: ClientListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScheduleClient(client);
  }

  function handleOpenComanda(client: ClientListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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

  const filterChips: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
    { key: "club", label: "Clube", icon: <Crown className="h-3.5 w-3.5" /> },
    { key: "overdue", label: "Retorno atrasado", icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "lastVisit", label: "Última visita", icon: <Calendar className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <PageHeader
        title="Clientes"
        description={`${filtered.length} de ${clients.length} cadastrados`}
        action={
          permissions.canManage ? (
            <div className="hidden lg:block">
              <ClientFormModal />
            </div>
          ) : undefined
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 min-h-[44px]"
          aria-label="Buscar clientes"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChips.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors",
              filters[key]
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-border bg-card text-muted-foreground hover:bg-accent"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
      </p>

      <div className="grid gap-2">
        {filtered.map((client) => {
          const overdue = isClientOverdue(client.lastVisitAt, client.returnDays);
          return (
            <Link
              key={client.id}
              href={`/clientes/${client.id}`}
              className="block rounded-2xl border border-border bg-card/80 p-4 transition-colors hover:border-amber-500/30 hover:bg-card active:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{client.name}</p>
                    {client.isClubMember && (
                      <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Membro do clube" />
                    )}
                    {overdue && (
                      <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
                        Retorno
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{formatPhone(client.phone)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {client.lastVisitAt && (
                      <span>
                        Último:{" "}
                        {format(new Date(client.lastVisitAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                    <span>{client.appointmentCount} visitas</span>
                    <span>Retorno: {client.returnDays}d</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>

              <div
                className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <QuickAction
                  label="WhatsApp"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={(e) => openWhatsApp(client, e)}
                />
                {permissions.canSchedule && (
                  <QuickAction
                    label="Agendar"
                    icon={<Calendar className="h-4 w-4" />}
                    onClick={(e) => handleSchedule(client, e)}
                  />
                )}
                {permissions.canSell && (
                  <QuickAction
                    label="Comanda"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    disabled={pending}
                    onClick={(e) => handleOpenComanda(client, e)}
                  />
                )}
                {permissions.canManage && (
                  <ClientFormModal
                    client={serializeClientForForm({
                      ...client,
                      birthday: client.birthday ? new Date(client.birthday) : null,
                    })}
                    edit
                    trigger={
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:flex-none sm:px-3"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    }
                  />
                )}
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState
            title={search || Object.values(filters).some(Boolean) ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            description={
              search || Object.values(filters).some(Boolean)
                ? "Tente outro termo ou remova os filtros."
                : "Cadastre seu primeiro cliente para começar."
            }
            action={permissions.canManage ? <ClientFormModal /> : undefined}
          />
        )}
      </div>

      {permissions.canManage && (
        <FixedActionBar className="lg:hidden">
          <ClientFormModal className="w-full" />
        </FixedActionBar>
      )}

      {scheduleClient && permissions.canSchedule && (
        <ClientScheduleModal
          open={!!scheduleClient}
          onOpenChange={(open) => !open && setScheduleClient(null)}
          clientName={scheduleClient.name}
          clientPhone={scheduleClient.phone}
          services={services}
          barbers={barbers}
        />
      )}
    </div>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <QuickActionButton label={label} icon={icon} onClick={onClick} disabled={disabled} />
  );
}

function QuickActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 sm:flex-none sm:px-3"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
