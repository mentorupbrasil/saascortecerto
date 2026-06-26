import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import { Card } from "@/components/ui/card";
import { ShieldOff } from "lucide-react";
import { LogoutButton } from "@/components/billing/logout-button";

export default async function ContaBloqueadaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supportEmail = getPlatformSupportEmail();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md text-center animate-fade-in">
        <ShieldOff className="h-14 w-14 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Conta bloqueada</h1>
        <p className="text-sm text-zinc-400 mb-4">
          O acesso à barbearia <strong className="text-white">{user.tenantName}</strong> foi
          suspenso por pendência de pagamento ou decisão administrativa.
        </p>
        <p className="text-sm text-zinc-500 mb-6">
          Se você já pagou, aguarde a confirmação ou entre em contato com{" "}
          <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">
            {supportEmail}
          </a>
          .
        </p>
        <LogoutButton />
      </Card>
    </div>
  );
}
