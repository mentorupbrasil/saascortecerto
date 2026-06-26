import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { canUseAutoWhatsApp, canUseManualWhatsApp } from "@/lib/plan-pricing";
import {
  getWhatsAppSettings,
  getReturnPreview,
  getWhatsAppMessageLog,
} from "@/lib/whatsapp-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { Card } from "@/components/ui/card";
import {
  WhatsAppSettingsForm,
  BulkSendButton,
  ManualReturnList,
  WhatsAppPlanBanner,
} from "@/components/whatsapp/whatsapp-panel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SendSingleButton } from "@/components/whatsapp/whatsapp-panel";
import { formatPhone } from "@/lib/utils";
import type { Plan } from "@prisma/client";

export default async function WhatsAppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  const tenantId = requireTenantId(user);

  const [{ settings, plan: rawPlan }, dueClients, messages] = await Promise.all([
    getWhatsAppSettings(),
    getReturnPreview(),
    getWhatsAppMessageLog(30),
  ]);

  const plan = rawPlan as Plan;

  if (!canUseManualWhatsApp(plan)) {
    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          <WhatsAppPlanBanner plan={plan} />
        </div>
      </TenantAppShell>
    );
  }

  const autoWhatsApp = canUseAutoWhatsApp(plan);
  const demoMode =
    autoWhatsApp &&
    (process.env.WHATSAPP_DEMO_MODE === "true" || !settings?.whatsappPhoneNumberId);

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          <p className="text-sm text-zinc-400">
            {autoWhatsApp
              ? "Disparo automático — traz o cliente de volta sem esforço"
              : "Retorno manual — o sistema avisa quem contatar, você envia pelo WhatsApp"}
          </p>
        </div>

        <WhatsAppPlanBanner plan={plan} />

        {autoWhatsApp && demoMode && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <p className="text-sm text-amber-300">
              <strong>Modo demo ativo:</strong> configure Phone Number ID e Access Token da Meta
              para envio automático real.
            </p>
          </Card>
        )}

        {autoWhatsApp ? (
          <>
            <BulkSendButton count={dueClients.length} />
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">
                Fila de retorno ({dueClients.length})
              </h2>
              <div className="space-y-2">
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
          </>
        ) : (
          <ManualReturnList clients={dueClients} />
        )}

        <WhatsAppSettingsForm settings={settings} plan={plan} />

        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Histórico</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-600 py-4 text-center">Nenhuma mensagem ainda</p>
            )}
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
                    {msg.status === "SENT" && !autoWhatsApp ? "MANUAL" : msg.status}
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
    </TenantAppShell>
  );
}
