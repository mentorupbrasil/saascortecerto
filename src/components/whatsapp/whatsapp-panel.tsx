"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updateWhatsAppSettings, sendBulkReturnMessages } from "@/lib/whatsapp-actions";
import { Send, Settings } from "lucide-react";

type Settings = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  whatsappReturnTemplate: string;
  autoReturnEnabled: boolean;
  returnMessageDays: number;
  lastBulkSendAt: Date | null;
};

export function WhatsAppSettingsForm({ settings }: { settings: Settings | null }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

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

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Configurações WhatsApp</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="whatsappEnabled"
            defaultChecked={settings?.whatsappEnabled}
            className="h-4 w-4 rounded accent-amber-500"
          />
          <span className="text-sm text-zinc-300">WhatsApp ativo</span>
        </label>

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
      const res = await sendBulkReturnMessages();
      setResult(res);
      router.refresh();
    });
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-green-400" />
            Cobrança em massa
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {count} clientes prontos para receber mensagem de retorno
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

export function SendSingleButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { sendSingleReturnMessage } = await import("@/lib/whatsapp-actions");
          await sendSingleReturnMessage(clientId);
          router.refresh();
        })
      }
      className="text-xs text-green-400 hover:underline disabled:opacity-50"
    >
      {pending ? "..." : "💬 Enviar WhatsApp"}
    </button>
  );
}
