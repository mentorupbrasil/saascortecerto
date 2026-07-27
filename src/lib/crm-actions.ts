"use server";

import { revalidatePath } from "next/cache";
import {
  requirePermission,
  requireTenantUser,
  AuthError,
} from "@/lib/authz";
import {
  getReportMetrics,
  metricsToCsv,
  type ReportPeriod,
} from "@/lib/reports/metrics";
import { exportClientData } from "@/lib/crm/export-client";
import { anonymizeClient } from "@/lib/crm/anonymize";
import { recordConsent, revokeConsent } from "@/lib/crm/consents";
import type { ConsentType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

function handleAuthError(err: unknown): never {
  if (err instanceof AuthError) throw new Error(err.message);
  throw err;
}

export async function getReportMetricsAction(period: ReportPeriod = "30d") {
  try {
    const user = await requireTenantUser();
    await requirePermission("reports:view");
    return getReportMetrics(user.tenantId, period);
  } catch (err) {
    handleAuthError(err);
  }
}

export async function exportReportCsvAction(period: ReportPeriod = "30d") {
  try {
    const user = await requireTenantUser();
    await requirePermission("reports:export");
    const metrics = await getReportMetrics(user.tenantId, period);
    const csv = metricsToCsv(metrics);
    await writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "report.exported",
      entityType: "Report",
      metadata: { period },
    });
    return { csv, filename: `relatorio-${period}-${Date.now()}.csv` };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function exportClientDataAction(clientId: string) {
  try {
    const user = await requireTenantUser();
    const data = await exportClientData(user, clientId);
    await writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "client.exported",
      entityType: "Client",
      entityId: clientId,
    });
    return data;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function anonymizeClientAction(clientId: string) {
  try {
    const user = await requireTenantUser();
    const result = await anonymizeClient(user, clientId);
    revalidatePath("/clientes");
    return result;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function recordConsentAction(
  clientId: string,
  type: ConsentType,
  granted: boolean
) {
  try {
    const user = await requireTenantUser();
    await requirePermission("clients:manage");
    await recordConsent({
      tenantId: user.tenantId,
      clientId,
      type,
      granted,
      source: "panel",
    });
    revalidatePath("/clientes");
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function revokeConsentAction(clientId: string, type: ConsentType) {
  try {
    const user = await requireTenantUser();
    await requirePermission("clients:manage");
    await revokeConsent(user.tenantId, clientId, type, "panel");
    revalidatePath("/clientes");
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}
