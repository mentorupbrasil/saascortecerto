import { credentialConfigured } from "@/lib/crypto/credentials";
import type { TenantSettings } from "@prisma/client";

export function getPublicBookingSettingsDto(settings: TenantSettings | null) {
  return {
    enabled: settings?.publicBookingEnabled ?? true,
    notifyPhone: settings?.bookingNotifyPhone ?? null,
    requirePixPayment: settings?.bookingRequirePixPayment ?? false,
    pixKey: settings?.bookingPixKey ?? null,
    pixHolderName: settings?.bookingPixHolderName ?? null,
    pixCity: settings?.bookingPixCity ?? null,
    mercadoPagoConfigured: credentialConfigured(settings?.mercadoPagoAccessToken),
  };
}
