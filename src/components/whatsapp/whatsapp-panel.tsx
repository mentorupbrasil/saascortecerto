"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/page-chrome";
import {
  updateWhatsAppSettings,
  sendBulkReturnMessages,
  markManualReturnSent,
} from "@/lib/whatsapp-actions";
import { formatPlanPrice, PLAN_LABELS, PLAN_WHATSAPP_DESCRIPTION } from "@/lib/plan-pricing";
import { formatPhone } from "@/lib/utils";
import type { Plan } from "@prisma/client";
import { ExternalLink, MessageCircle, Send, Settings, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Settings = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappTokenConfigured: boolean;
  whatsappReturnTemplate: string;
  autoReturnEnabled: boolean;
  returnMessageDays: number;
  lastBulkSendAt: Date | null;
};

type DueClient = {
  id: string;
  name: string;
  phone: string;
  daysSince: number;
  waUrl: string;
};

type MessageLog = {
  id: string;
  phone: string;
  message: string;
  status: string;
  createdAt: Date;
};

const TABS = [
  { id: "retornos", label: "Retornos" },
  { id: "historico", label: "Histórico" },
  { id: "config", label: "Configuração" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MESSAGE_STATUS_LABELS: Record<string, string> = {
  SENT: "Enviado",
  SIMULATED: "Simulado",
  FAILED: "Falhou",
  PENDING: "Pendente",
  MANUAL: "Manual",
};

function translateMessageStatus(status: string, autoWhatsApp: boolean): string {
  if (status === "SENT" && !autoWhatsApp) return MESSAGE_STATUS_LABELS.MANUAL;
  return MESSAGE_STATUS_LABELS[status] ?? status;
}

function statusBadgeClass(status: string, autoWhatsApp: boolean): string {
  const effective = status === "SENT" && !autoWhatsApp ? "MANUAL" : status;
  if (effective === "SENT" || effective === "MANUAL") {
    return "bg-green-500/20 text-green-400";
  }
  if (effective === "SIMULATED") return "bg-amber-500/20 text-amber-400";
  if (effective === "PENDING") return "bg-zinc-700 text-zinc-300";
  return "bg-red-500/20 text-red-400";
}

export function WhatsAppPlanBanner({ plan }: { plan: Plan }) {
  const isAuto = plan === "CLUBE";

  return (
    <Card className={isAuto ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}>
      <div className="flex items-start gap-3">
        <MessageCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isAuto ? "text-green-400" : "text-amber-400"}`} />
        <div>
          <p className="text-sm font-medium text-foreground">
            Plano {PLAN_LABELS[plan]} — {formatPlanPrice(plan)}/mês
          </p>
          <p className="text-sm text-zinc-400 mt-1">{PLAN_WHATSAPP_DESCRIPTION[plan]}</p>
          {!isAuto && plan === "PRO" && (
            <p className="text-xs text-zinc-500 mt-2">
              O sistema mostra quem avisar. Você abre o WhatsApp com a mensagem pronta e envia com 1 clique.
            </p>
          )}
          {plan === "FREE" && (
            <p className="text-xs text-amber-400 mt-2">
              Faça upgrade para Básico ou Pro para usar retorno por WhatsApp.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function WhatsAppPanel({
  plan,
  settings,
  dueClients,
  messages,
  autoWhatsApp,
  demoMode,
}: {
  plan: Plan;
  settings: Settings | null;
  dueClients: DueClient[];
  messages: MessageLog[];
  autoWhatsApp: boolean;
  demoMode: boolean;
}) {
  const [tab, setTab] = useState<TabId>("retornos");

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              tab === t.id
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "bg-zinc-800 text-zinc-400 hover:text-foreground border border-transparent"
            )}
          >
            {t.label}
            {t.id === "retornos" && dueClients.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs">
                {dueClients.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "retornos" && (
        <RetornosTab
          plan={plan}
          dueClients={dueClients}
          autoWhatsApp={autoWhatsApp}
          demoMode={demoMode}
        />
      )}

      {tab === "historico" && (
        <HistoricoTab messages={messages} autoWhatsApp={autoWhatsApp} />
      )}

      {tab === "config" && (
        <ConfigTab settings={settings} plan={plan} />
      )}
    </div>
  );
}

function RetornosTab({
  plan,
  dueClients,
  autoWhatsApp,
  demoMode,
}: {
  plan: Plan;
  dueClients: DueClient[];
  autoWhatsApp: boolean;
  demoMode: boolean;
}) {
  return (
    <div className="space-y-4">
      <WhatsAppPlanBanner plan={plan} />

      {autoWhatsApp && demoMode && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-300">
            <strong>Modo demo ativo:</strong> configure Phone Number ID e Access Token da Meta
            para envio automático real.
          </p>
        </Card>
      )}

      {autoWhatsApp ? (
        <>
          <BulkSendButton count={dueClients.length} />
          <AutoReturnQueue clients={dueClients} />
        </>
      ) : (
        <ManualReturnList clients={dueClients} />
      )}
    </div>
  );
}

function AutoReturnQueue({ clients }: { clients: DueClient[] }) {
  if (clients.length === 0) {
    return (
      <EmptyState
        title="Fila vazia"
        description="Nenhum cliente precisa de retorno agora."
        icon={<MessageCircle className="h-8 w-8" />}
      />
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Fila de retorno ({clients.length})
      </h2>
      <p className="text-sm text-zinc-400 mb-4">
        Envie mensagens automáticas ou dispare em massa acima.
      </p>
      <div className="space-y-2">
        {clients.map((client) => (
          <div
            key={client.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-zinc-900 px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{client.name}</p>
              <p className="text-xs text-zinc-500">
                {formatPhone(client.phone)} · {client.daysSince} dias
              </p>
            </div>
            <SendSingleButton clientId={client.id} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function HistoricoTab({
  messages,
  autoWhatsApp,
}: {
  messages: MessageLog[];
  autoWhatsApp: boolean;
}) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="Nenhuma mensagem ainda"
        description="O histórico de retornos enviados aparecerá aqui."
        icon={<History className="h-8 w-8" />}
      />
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-foreground mb-4">Histórico de mensagens</h2>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className="rounded-lg bg-zinc-900 px-3 py-3 text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="text-zinc-300 font-medium">{formatPhone(msg.phone)}</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full shrink-0",
                  statusBadgeClass(msg.status, autoWhatsApp)
                )}
              >
                {translateMessageStatus(msg.status, autoWhatsApp)}
              </span>
            </div>
            <p className="text-zinc-500 text-xs mt-1.5 line-clamp-2">{msg.message}</p>
            <p className="text-zinc-600 text-xs mt-1">
              {format(msg.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConfigTab({
  settings,
  plan,
}: {
  settings: Settings | null;
  plan: Plan;
}) {
  if (plan === "FREE") {
    return (
      <EmptyState
        title="Upgrade necessário"
        description="Faça upgrade para Básico ou Pro para configurar retorno por WhatsApp."
        icon={<Settings className="h-8 w-8" />}
      />
    );
  }

  return <WhatsAppSettingsForm settings={settings} plan={plan} />;
}

export function WhatsAppSettingsForm({
  settings,
  plan,
}: {
  settings: Settings | null;
  plan: Plan;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const autoAllowed = plan === "CLUBE";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateWhatsAppSettings(formData);
        toast.success("Configurações salvas");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-foreground">Configurações</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            name="whatsappEnabled"
            defaultChecked={settings?.whatsappEnabled ?? true}
            className="h-5 w-5 rounded accent-amber-500"
          />
          <span className="text-sm text-zinc-300">Retorno por WhatsApp ativo</span>
        </label>

        <Input
          name="returnMessageDays"
          label="Intervalo de cobrança (dias)"
          type="number"
          min={7}
          max={90}
          defaultValue={settings?.returnMessageDays ?? 20}
        />

        <Textarea
          name="whatsappReturnTemplate"
          label="Mensagem de retorno"
          defaultValue={
            settings?.whatsappReturnTemplate ??
            "Fala {nome}! Já faz {dias} dias do seu último corte na {barbearia}. Bora marcar? ✂️"
          }
        />
        <p className="text-xs text-zinc-500">
          Variáveis: {"{nome}"}, {"{dias}"}, {"{barbearia}"}
        </p>

        {autoAllowed && (
          <>
            <hr className="border-zinc-800" />
            <p className="text-sm font-medium text-foreground">API Meta (disparo automático)</p>
            <Input
              name="whatsappPhoneNumberId"
              label="Phone Number ID (Meta Cloud API)"
              placeholder="123456789012345"
              defaultValue={settings?.whatsappPhoneNumberId ?? ""}
            />
            <Input
              name="newWhatsAppAccessToken"
              label="Access Token (deixe vazio para manter o atual)"
              type="password"
              placeholder="EAAxxxx..."
            />
            {settings?.whatsappTokenConfigured && (
              <p className="text-xs text-green-400">Token já configurado</p>
            )}
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                name="autoReturnEnabled"
                defaultChecked={settings?.autoReturnEnabled}
                className="h-5 w-5 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-300">
                Envio automático diário (via cron)
              </span>
            </label>
          </>
        )}

        <Button type="submit" disabled={pending} className="w-full min-h-[44px]">
          {pending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </form>
    </Card>
  );
}

export function BulkSendButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
    simulated: number;
  } | null>(null);
  const router = useRouter();
  const toast = useToast();

  function handleSend() {
    startTransition(async () => {
      try {
        const res = await sendBulkReturnMessages();
        setResult(res);
        toast.success(
          `Enviados: ${res.sent + res.simulated} · Falhas: ${res.failed}`
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar");
      }
    });
  }

  return (
    <>
      <Card className="border-green-500/20 bg-green-500/5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-green-400" />
              Disparo automático em massa
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {count} clientes prontos — envio via API Meta
            </p>
          </div>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={pending || count === 0}
            className="bg-green-600 hover:bg-green-500 min-h-[48px] w-full sm:w-auto"
          >
            {pending ? "Enviando..." : `Enviar para ${count} clientes`}
          </Button>
        </div>

        {result && (
          <div className="mt-4 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">
            Enviados: {result.sent + result.simulated} · Falhas: {result.failed} · Total:{" "}
            {result.total}
            {result.simulated > 0 && (
              <span className="block text-amber-400 mt-1">
                Modo demo: mensagens simuladas (configure API Meta para envio real)
              </span>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Enviar retornos em massa?"
        description={`Enviar mensagem de retorno para ${count} clientes agora?`}
        confirmLabel="Enviar agora"
        loading={pending}
        onConfirm={handleSend}
      />
    </>
  );
}

export function ManualReturnList({
  clients,
}: {
  clients: DueClient[];
}) {
  if (clients.length === 0) {
    return (
      <EmptyState
        title="Ninguém na fila"
        description="Nenhum cliente precisa de retorno agora."
        icon={<MessageCircle className="h-8 w-8" />}
      />
    );
  }

  return (
    <Card className="border-amber-500/20">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
        <MessageCircle className="h-5 w-5 text-amber-400" />
        Quem avisar hoje ({clients.length})
      </h2>
      <p className="text-sm text-zinc-400 mb-4">
        Abra o WhatsApp com a mensagem pronta. Depois de enviar, marque como enviado para sair da fila.
      </p>
      <div className="space-y-2">
        {clients.map((client) => (
          <ManualWhatsAppButton key={client.id} client={client} />
        ))}
      </div>
    </Card>
  );
}

function ManualWhatsAppButton({
  client,
}: {
  client: DueClient;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-900 px-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{client.name}</p>
        <p className="text-xs text-zinc-500">{client.daysSince} dias sem retorno</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={client.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 text-sm font-medium text-foreground hover:bg-green-500"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir WhatsApp
        </a>
        <Button
          variant="secondary"
          disabled={pending}
          className="min-h-[44px] flex-1"
          onClick={() =>
            startTransition(async () => {
              try {
                await markManualReturnSent(client.id);
                toast.success("Marcado como enviado");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro ao marcar");
              }
            })
          }
        >
          {pending ? "..." : "Já enviei"}
        </Button>
      </div>
    </div>
  );
}

export function SendSingleButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <Button
      disabled={pending}
      className="min-h-[44px] bg-green-600 hover:bg-green-500 w-full sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          try {
            const { sendSingleReturnMessage } = await import("@/lib/whatsapp-actions");
            await sendSingleReturnMessage(clientId);
            toast.success("Mensagem enviada");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao enviar");
          }
        })
      }
    >
      {pending ? "Enviando..." : "Enviar automático"}
    </Button>
  );
}

export function ManualWhatsAppLink({
  clientId,
  waUrl,
}: {
  clientId: string;
  waUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="flex items-center gap-2">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-green-400 hover:underline min-h-[44px] inline-flex items-center"
      >
        Abrir WhatsApp
      </a>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await markManualReturnSent(clientId);
              toast.success("Marcado como enviado");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erro");
            }
          })
        }
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 min-h-[44px] min-w-[44px]"
      >
        {pending ? "..." : "✓"}
      </button>
    </div>
  );
}
