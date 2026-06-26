"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updatePublicBookingSettings } from "@/lib/public-booking-actions";
import { Bell, CreditCard } from "lucide-react";

export function PublicBookingSettings({
  enabled,
  notifyPhone,
  requirePixPayment,
  pixKey,
  pixHolderName,
  pixCity,
  mercadoPagoAccessToken,
}: {
  enabled: boolean;
  notifyPhone: string | null;
  requirePixPayment: boolean;
  pixKey: string | null;
  pixHolderName: string | null;
  pixCity: string | null;
  mercadoPagoAccessToken: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updatePublicBookingSettings(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Agendamento online</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="publicBookingEnabled"
            defaultChecked={enabled}
            className="h-4 w-4 rounded accent-amber-500"
          />
          <span className="text-sm text-zinc-300">Permitir clientes agendarem pelo link</span>
        </label>

        <Input
          name="bookingNotifyPhone"
          label="WhatsApp para avisos de novo agendamento"
          placeholder="(11) 99999-9999"
          defaultValue={notifyPhone ?? ""}
        />

        <div className="border-t border-zinc-800 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-medium text-white">Pagamento PIX antes de agendar</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="bookingRequirePixPayment"
              defaultChecked={requirePixPayment}
              className="h-4 w-4 rounded accent-amber-500"
            />
            <span className="text-sm text-zinc-300">
              Exigir PIX para confirmar horário pelo link
            </span>
          </label>

          <Input
            name="bookingPixKey"
            label="Sua chave PIX (CPF, e-mail, telefone ou aleatória)"
            placeholder="seu@email.com ou +5511999999999"
            defaultValue={pixKey ?? ""}
          />
          <Input
            name="bookingPixHolderName"
            label="Nome do recebedor (como aparece no PIX)"
            placeholder="Barbearia do João"
            defaultValue={pixHolderName ?? ""}
          />
          <Input
            name="bookingPixCity"
            label="Cidade (para o QR Code PIX)"
            placeholder="SAO PAULO"
            defaultValue={pixCity ?? "SAO PAULO"}
          />
          <Input
            name="mercadoPagoAccessToken"
            label="Token Mercado Pago (confirmação automática)"
            type="password"
            placeholder="APP_USR-... (opcional, recomendado)"
            defaultValue={mercadoPagoAccessToken ?? ""}
          />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Com o token Mercado Pago da sua conta, o sistema detecta o pagamento PIX e confirma o
            agendamento sozinho. Só com chave PIX, o cliente paga e você confirma manualmente na
            agenda (ou toca em “Já paguei” no link).
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          Plano Completo: aviso automático via API. Plano Pro: registro + link WhatsApp no histórico.
        </p>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}
