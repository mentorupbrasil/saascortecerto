"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updatePublicBookingSettings } from "@/lib/public-booking-actions";
import { Bell } from "lucide-react";

export function PublicBookingSettings({
  enabled,
  notifyPhone,
}: {
  enabled: boolean;
  notifyPhone: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updatePublicBookingSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
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
        <p className="text-xs text-zinc-500">
          Plano Completo: aviso automático via API. Plano Pro: registro + link WhatsApp no histórico.
        </p>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}
