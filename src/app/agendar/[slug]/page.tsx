import { notFound } from "next/navigation";
import { getPublicBookingPage } from "@/lib/public-booking-actions";
import {
  PublicBookingForm,
  PublicBookingHeader,
} from "@/components/booking/public-booking-form";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPublicBookingPage(slug);

  if (!tenant) notFound();

  if (tenant.services.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <p className="text-zinc-400">Agendamento online indisponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <PublicBookingHeader tenant={tenant} />
        <PublicBookingForm tenant={tenant} />
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
