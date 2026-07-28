import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { getWaitlistOfferPreview } from "@/lib/public-waitlist-actions";
import { WaitlistOfferConfirmButton } from "@/components/waitlist/waitlist-offer-confirm";
import { Calendar, Clock, Scissors, User } from "lucide-react";

export default async function WaitlistConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const offer = await getWaitlistOfferPreview(token);

  if (!offer) notFound();

  const isUnavailable =
    offer.status !== "OFFERED" || offer.alreadyUsed || offer.expired || !offer.scheduledAt;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 safe-bottom">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-foreground">{offer.tenantName}</h1>
          <p className="text-sm text-zinc-500">Confirmação de horário — lista de espera</p>
        </div>

        {isUnavailable ? (
          <Card className="text-center">
            <p className="text-sm text-zinc-400">
              {offer.alreadyUsed
                ? "Este horário já foi confirmado anteriormente."
                : "Esta oferta não está mais disponível. Entre em contato com a barbearia."}
            </p>
          </Card>
        ) : (
          <>
            <Card className="mb-4 space-y-3">
              <InfoRow icon={User} label="Cliente" value={offer.clientName} />
              <InfoRow icon={Scissors} label="Serviço" value={offer.serviceName} />
              {offer.barberName && (
                <InfoRow icon={User} label="Profissional" value={offer.barberName} />
              )}
              <InfoRow
                icon={Calendar}
                label="Data"
                value={format(new Date(offer.scheduledAt!), "EEEE, d 'de' MMMM", {
                  locale: ptBR,
                })}
              />
              <InfoRow
                icon={Clock}
                label="Horário"
                value={format(new Date(offer.scheduledAt!), "HH:mm", { locale: ptBR })}
              />
              {offer.expiresAt && (
                <p className="pt-1 text-xs text-zinc-600">
                  Esta oferta expira em{" "}
                  {format(new Date(offer.expiresAt), "dd/MM 'às' HH:mm", { locale: ptBR })}.
                </p>
              )}
            </Card>

            <WaitlistOfferConfirmButton token={token} />
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="capitalize text-zinc-200">{value}</p>
      </div>
    </div>
  );
}
