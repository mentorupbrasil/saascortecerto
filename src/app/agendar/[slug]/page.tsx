import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicBookingPage } from "@/lib/public-booking-actions";
import {
  PublicBookingForm,
  PublicBookingHeader,
} from "@/components/booking/public-booking-form";
import { brand } from "@/config/brand";

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
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:py-10 safe-bottom overflow-x-hidden">
      <div className="mx-auto max-w-lg">
        <PublicBookingHeader tenant={tenant} />
        <PublicBookingForm tenant={tenant} />
        <p className="text-center text-xs text-zinc-600 mt-8">
          Agendamento via{" "}
          <Link href="/" className="text-zinc-500 hover:text-amber-400">
            {brand.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
