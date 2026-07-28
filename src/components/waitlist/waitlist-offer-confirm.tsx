"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmWaitlistOfferAction } from "@/lib/public-waitlist-actions";
import { CheckCircle2 } from "lucide-react";

export function WaitlistOfferConfirmButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    scheduledAt: string;
    serviceName: string;
    tenantName: string;
  } | null>(null);

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      try {
        const result = await confirmWaitlistOfferAction(token);
        setSuccess(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível confirmar");
      }
    });
  }

  if (success) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-400" />
        <h2 className="mb-1 text-lg font-semibold text-foreground">Horário confirmado!</h2>
        <p className="text-sm text-zinc-400">
          Seu horário em <strong className="text-foreground">{success.tenantName}</strong> foi
          confirmado. Até breve!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full" onClick={handleConfirm} disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar este horário"}
      </Button>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
          {error}
        </p>
      )}
      <Link
        href="/"
        className="block text-center text-xs text-zinc-600 hover:text-zinc-400"
      >
        Voltar
      </Link>
    </div>
  );
}
