import "server-only";

export type FiscalDocumentRequest = {
  tenantId: string;
  saleId: string;
  amount: number;
  description?: string;
};

export type FiscalDocumentResult = {
  ok: boolean;
  status: "issued" | "pending" | "failed" | "not_configured" | "cancelled";
  externalId?: string;
  error?: string;
};

export interface FiscalProvider {
  emit(request: FiscalDocumentRequest): Promise<FiscalDocumentResult>;
  cancel(externalId: string, tenantId: string): Promise<FiscalDocumentResult>;
  status(externalId: string, tenantId: string): Promise<FiscalDocumentResult>;
}

export class NotConfiguredFiscalProvider implements FiscalProvider {
  async emit(): Promise<FiscalDocumentResult> {
    return {
      ok: false,
      status: "not_configured",
      error: "Emissor fiscal não configurado. Configure um provedor NF-e/NFS-e.",
    };
  }

  async cancel(): Promise<FiscalDocumentResult> {
    return {
      ok: false,
      status: "not_configured",
      error: "Emissor fiscal não configurado.",
    };
  }

  async status(): Promise<FiscalDocumentResult> {
    return {
      ok: false,
      status: "not_configured",
      error: "Emissor fiscal não configurado.",
    };
  }
}

let cached: FiscalProvider | null = null;

export function getFiscalProvider(): FiscalProvider {
  if (cached) return cached;
  cached = new NotConfiguredFiscalProvider();
  return cached;
}
