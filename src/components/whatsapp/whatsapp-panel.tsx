"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  updateWhatsAppSettings,
  sendBulkReturnMessages,
  markManualReturnSent,
} from "@/lib/whatsapp-actions";
import { formatPlanPrice, PLAN_LABELS, PLAN_WHATSAPP_DESCRIPTION } from "@/lib/plan-pricing";
import type { Plan } from "@prisma/client";
import { ExternalLink, MessageCircle, Send, Settings } from "lucide-react";

type Settings = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  whatsappReturnTemplate: string;
  autoReturnEnabled: boolean;
  returnMessageDays: number;
  lastBulkSendAt: Date | null;
};

export function WhatsAppPlanBanner({ plan }: { plan: Plan }) {
  const isAuto = plan === "CLUBE";

  return (
    <Card className={isAuto ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}>
      <div className="flex items-start gap-3">
        <MessageCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isAuto ? "text-green-400" : "text-amber-400"}`} />
        <div>
          <p className="text-sm font-medium text-white">
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
              Faça upgrade para Pro ou Completo para usar retorno por WhatsApp.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function WhatsAppSettingsForm({
  settings,
  plan,
}: {
  settings: Settings | null;
  plan: Plan;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const autoAllowed = plan === "CLUBE";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateWhatsAppSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  if (plan === "FREE") return null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Configurações</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="whatsappEnabled"
            defaultChecked={settings?.whatsappEnabled ?? true}
            className="h-4 w-4 rounded accent-amber-500"
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
            <p className="text-sm font-medium text-white">API Meta (disparo automático)</p>
            <Input
              name="whatsappPhoneNumberId"
              label="Phone Number ID (Meta Cloud API)"
              placeholder="123456789012345"
              defaultValue={settings?.whatsappPhoneNumberId ?? ""}
            />
            <Input
              name="whatsappAccessToken"
              label="Access Token (deixe vazio para manter o atual)"
              type="password"
              placeholder="EAAxxxx..."
            />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="autoReturnEnabled"
                defaultChecked={settings?.autoReturnEnabled}
                className="h-4 w-4 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-300">
                Envio automático diário (via cron)
              </span>
            </label>
          </>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar configurações"}
        </Button>
      </form>
    </Card>
  );
}

export function BulkSendButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
    simulated: number;
  } | null>(null);
  const router = useRouter();

  function handleSend() {
    if (!confirm(`Enviar mensagem de retorno para ${count} clientes agora?`)) return;

    startTransition(async () => {
      try {
        const res = await sendBulkReturnMessages();
        setResult(res);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erro ao enviar");
      }
    });
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-green-400" />
            Disparo automático em massa
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {count} clientes prontos — envio via API Meta
          </p>
        </div>
        <Button
          onClick={handleSend}
          disabled={pending || count === 0}
          className="bg-green-600 hover:bg-green-500"
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
  );
}

export function ManualReturnList({
  clients,
}: {
  clients: Array<{
    id: string;
    name: string;
    phone: string;
    daysSince: number;
    waUrl: string;
  }>;
}) {
  return (
    <Card className="border-amber-500/20">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
        <MessageCircle className="h-5 w-5 text-amber-400" />
        Quem avisar hoje ({clients.length})
      </h2>
      <p className="text-sm text-zinc-400 mb-4">
        Abra o WhatsApp com a mensagem pronta. Depois de enviar, marque como enviado para sair da fila.
      </p>
      <div className="space-y-2">
        {clients.length === 0 && (
          <p className="text-zinc-600 text-sm py-4 text-center">Nenhum cliente na fila agora 🎉</p>
        )}
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
  client: { id: string; name: string; phone: string; daysSince: number; waUrl: string };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-zinc-900 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-white">{client.name}</p>
        <p className="text-xs text-zinc-500">{client.daysSince} dias sem retorno</p>
      </div>
      <div className="flex gap-2">
        <a
          href={client.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir WhatsApp
        </a>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await markManualReturnSent(client.id);
              router.refresh();
            })
          }
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "..." : "Já enviei"}
        </button>
      </div>
    </div>
  );
}

export function SendSingleButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const { sendSingleReturnMessage } = await import("@/lib/whatsapp-actions");
            await sendSingleReturnMessage(clientId);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao enviar");
          }
        })
      }
      className="text-xs text-green-400 hover:underline disabled:opacity-50"
    >
      {pending ? "..." : "Enviar automático"}
    </button>
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

  return (
    <div className="flex items-center gap-2">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-green-400 hover:underline"
      >
        Abrir WhatsApp
      </a>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markManualReturnSent(clientId);
            router.refresh();
          })
        }
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
      >
        {pending ? "..." : "✓"}
      </button>
    </div>
  );
}
