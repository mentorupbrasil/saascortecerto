import Link from "next/link";
import { redirect } from "next/navigation";
import { getSignupCheckoutPublic } from "@/lib/signup-actions";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  if (!params.checkout) redirect("/assinar");

  const checkout = await getSignupCheckoutPublic(params.checkout);
  if (!checkout || checkout.status !== "PAID") {
    redirect(`/assinar/${params.checkout}/pagamento`);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Card>
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Barbearia criada!</h1>
          <p className="text-zinc-400 mb-2">
            <strong className="text-white">{checkout.barbershopName}</strong> está pronta para usar.
          </p>
          <p className="text-sm text-zinc-500 mb-6">
            Plano {checkout.planLabel} · Ambiente exclusivo e isolado
          </p>
          <Link href="/login">
            <Button size="lg" className="w-full">
              Entrar no sistema
            </Button>
          </Link>
        </Card>
        <p className="text-xs text-zinc-600 mt-4">
          Use o e-mail <strong>{checkout.ownerEmail}</strong> e a senha que você definiu.
        </p>
      </div>
    </div>
  );
}
