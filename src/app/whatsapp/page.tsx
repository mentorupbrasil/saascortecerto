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
import {
  WhatsAppPanel,
  WhatsAppPlanBanner,
} from "@/components/whatsapp/whatsapp-panel";
import type { Plan } from "@prisma/client";
import { isWhatsAppDemoMode } from "@/lib/env";

export default async function WhatsAppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  requireTenantId(user);

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
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-sm text-zinc-400">Retorno de clientes por WhatsApp</p>
          </div>
          <WhatsAppPlanBanner plan={plan} />
        </div>
      </TenantAppShell>
    );
  }

  const autoWhatsApp = canUseAutoWhatsApp(plan);
  const demoMode =
    autoWhatsApp &&
    (isWhatsAppDemoMode() ||
      !settings?.whatsappPhoneNumberId ||
      !settings?.whatsappTokenConfigured);

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-sm text-zinc-400">
            {autoWhatsApp
              ? "Disparo automático — traz o cliente de volta sem esforço"
              : "Retorno manual — o sistema avisa quem contatar, você envia pelo WhatsApp"}
          </p>
        </div>

        <WhatsAppPanel
          plan={plan}
          settings={settings}
          dueClients={dueClients}
          messages={messages}
          autoWhatsApp={autoWhatsApp}
          demoMode={demoMode}
        />
      </div>
    </TenantAppShell>
  );
}
