import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getComandasPanelData, getEstoquePanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ComandasPanel } from "@/components/finance/comandas-panel";
import { PageHeader } from "@/components/ui/page-chrome";
import { ShoppingCart } from "lucide-react";

export default async function ComandasPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  try {
    const data = await getComandasPanelData();

    let products: { id: string; name: string; price: number; stockQty: number }[] = [];
    try {
      const estoque = await getEstoquePanelData();
      products = estoque.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stockQty: p.stockQty,
      }));
    } catch {
      // Sem permissão de estoque — produtos ficam indisponíveis na UI
    }

    const canDiscount = ["OWNER", "MANAGER", "SUPER_ADMIN"].includes(user.role);

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6 pb-28 lg:pb-6">
          <PageHeader
            title="Comandas"
            description="Registre vendas de serviços e produtos. A receita entra aqui — concluir agendamento não lança venda automaticamente."
            action={
              <ShoppingCart className="hidden lg:block h-7 w-7 text-amber-400" aria-hidden />
            }
          />
          <ComandasPanel
            data={{
              ...data,
              products,
              canDiscount,
            }}
          />
        </div>
      </TenantAppShell>
    );
  } catch (err) {
    if (err instanceof AuthError && err.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw err;
  }
}
