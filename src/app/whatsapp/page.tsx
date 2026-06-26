import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import {
  getWhatsAppSettings,
  getReturnPreview,
  getWhatsAppMessageLog,
} from "@/lib/whatsapp-actions";
import { AppShell } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import {
  WhatsAppSettingsForm,
  BulkSendButton,
} from "@/components/whatsapp/whatsapp-panel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SendSingleButton } from "@/components/whatsapp/whatsapp-panel";
import { formatPhone } from "@/lib/utils";

export default async function WhatsAppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  requireTenantId(user);

  const [{ settings }, dueClients, messages] = await Promise.all([
    getWhatsAppSettings(),
    getReturnPreview(),
    getWhatsAppMessageLog(30),
  ]);

  const demoMode =
    process.env.WHATSAPP_DEMO_MODE === "true" ||
    !settings?.whatsappPhoneNumberId;

  return (
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          <p className="text-sm text-zinc-400">
            Cobrança automática — traz o cliente de volta antes que ele esqueça
          </p>
        </div>

        {demoMode && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <p className="text-sm text-amber-300">
              <strong>Modo demo ativo:</strong> mensagens são simuladas. Configure Phone Number ID
              e Access Token da Meta Cloud API para envio real. Enquanto isso, use o botão abaixo
              para testar o fluxo completo.
            </p>
          </Card>
        )}

        <BulkSendButton count={dueClients.length} />

        <WhatsAppSettingsForm settings={settings} />

        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">
            Fila de retorno ({dueClients.length})
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Clientes que passaram do intervalo ({settings?.returnMessageDays ?? 20} dias) desde o
            último corte ou última mensagem.
            {settings?.lastBulkSendAt && (
              <span className="block mt-1">
                Último envio em massa:{" "}
                {format(settings.lastBulkSendAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
          </p>

          <div className="space-y-2">
            {dueClients.length === 0 && (
              <p className="text-zinc-600 text-sm py-4 text-center">
                Nenhum cliente na fila agora 🎉
              </p>
            )}
            {dueClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-white">{client.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatPhone(client.phone)} · {client.daysSince} dias
                  </p>
                </div>
                <SendSingleButton clientId={client.id} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Histórico de mensagens</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-400">{formatPhone(msg.phone)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      msg.status === "SENT"
                        ? "bg-green-500/20 text-green-400"
                        : msg.status === "SIMULATED"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {msg.status}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{msg.message}</p>
                <p className="text-zinc-600 text-xs mt-1">
                  {format(msg.createdAt, "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
