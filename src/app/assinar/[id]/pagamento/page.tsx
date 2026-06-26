import { PaymentPageClient } from "@/components/marketing/payment-page";

export default async function PagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentPageClient checkoutId={id} />;
}
