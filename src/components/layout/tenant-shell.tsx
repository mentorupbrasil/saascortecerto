import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { ensureTenantIsActive, getTenantBillingForSession } from "@/lib/billing-actions";
import { AppShell } from "@/components/layout/sidebar";
import type { BillingAlertProps } from "@/lib/billing-actions";

export async function TenantAppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (isSuperAdmin(user) && !user.tenantId) {
    return <AppShell>{children}</AppShell>;
  }

  if (user.tenantId) {
    const active = await ensureTenantIsActive(user.tenantId);
    if (!active) redirect("/conta-bloqueada");
  }

  const billing = await getTenantBillingForSession();
  const billingAlert: BillingAlertProps | null = billing?.openInvoice
    ? {
        level: billing.alertLevel,
        message: billing.alertMessage,
        invoiceId: billing.openInvoice.id,
        amount: billing.openInvoice.amount,
        dueDate: billing.openInvoice.dueDate,
      }
    : billing?.hasAwaitingConfirmation
      ? {
          level: "upcoming",
          message: "Pagamento informado. Aguardando confirmação da plataforma.",
          invoiceId: null,
          amount: null,
          dueDate: null,
        }
      : null;

  return <AppShell billingAlert={billingAlert}>{children}</AppShell>;
}
