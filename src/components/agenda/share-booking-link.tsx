"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link2, Copy, Check, Share2 } from "lucide-react";

export function ShareBookingLink({
  slug,
  enabled,
}: {
  slug: string;
  enabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/agendar/${slug}`;

  function copyLink() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    if (navigator.share) {
      await navigator.share({
        title: "Agende seu horário",
        text: "Escolha o melhor horário e agende online:",
        url,
      });
    } else {
      copyLink();
    }
  }

  if (!enabled) {
    return (
      <Card className="border-zinc-700">
        <p className="text-sm text-zinc-500">
          Agendamento online desativado. Ative abaixo para compartilhar o link.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <Link2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">Link para clientes agendarem</h3>
          <p className="text-xs text-zinc-400 mt-1 mb-3">
            Envie nos grupos do WhatsApp. O cliente vê horários livres e agenda sozinho.
          </p>
          <code className="block text-xs bg-zinc-900 rounded-lg px-3 py-2 text-amber-200/80 break-all mb-3">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <Button type="button" size="sm" onClick={shareNative}>
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
