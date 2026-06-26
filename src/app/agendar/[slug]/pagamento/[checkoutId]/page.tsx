import { notFound } from "next/navigation";
import { getPublicBookingPage } from "@/lib/public-booking-actions";
import { PublicBookingHeader } from "@/components/booking/public-booking-form";
import { PublicBookingPaymentClient } from "@/components/booking/public-booking-payment";

export default async function PublicBookingPaymentPage({
  params,
}: {
  params: Promise<{ slug: string; checkoutId: string }>;
}) {
  const { slug, checkoutId } = await params;
  const tenant = await getPublicBookingPage(slug);

  if (!tenant) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:py-10 safe-bottom overflow-x-hidden">
      <div className="mx-auto max-w-lg">
        <PublicBookingHeader tenant={tenant} />
        <PublicBookingPaymentClient slug={slug} checkoutId={checkoutId} />
        <p className="text-center text-xs text-zinc-600 mt-8">
          Agendamento via{" "}
          <a href="/" className="text-zinc-500 hover:text-amber-400">
            CorteCerto
          </a>
        </p>
      </div>
    </div>
  );
}
