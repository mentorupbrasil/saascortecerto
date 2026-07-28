import { describe, expect, it } from "vitest";
import { getPublicBookingSettingsDto } from "@/lib/public-booking-settings-dto";
import type { TenantSettings } from "@prisma/client";

function minimalSettings(
  overrides: Partial<TenantSettings> = {}
): TenantSettings {
  return {
    id: "settings-1",
    tenantId: "tenant-1",
    whatsappEnabled: false,
    whatsappPhoneNumberId: null,
    whatsappAccessToken: null,
    whatsappReturnTemplate: "template",
    autoReturnEnabled: false,
    returnMessageDays: 20,
    lastBulkSendAt: null,
    openTime: "07:00",
    closeTime: "22:00",
    workingDays: "1,2,3,4,5,6",
    publicBookingEnabled: true,
    bookingNotifyPhone: null,
    bookingRequirePixPayment: false,
    bookingPixKey: null,
    bookingPixHolderName: null,
    bookingPixCity: "SAO PAULO",
    mercadoPagoAccessToken: "ccenc:v1:abc:def:ghi",
    timeZone: "America/Sao_Paulo",
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    ...overrides,
  };
}

describe("getPublicBookingSettingsDto", () => {
  it("returns mercadoPagoConfigured boolean only, never the token", () => {
    const dto = getPublicBookingSettingsDto(minimalSettings());

    expect(dto.mercadoPagoConfigured).toBe(true);
    expect(dto).not.toHaveProperty("mercadoPagoAccessToken");
    expect(Object.keys(dto)).not.toContain("mercadoPagoAccessToken");
  });

  it("reports mercadoPagoConfigured false when token absent", () => {
    const dto = getPublicBookingSettingsDto(
      minimalSettings({ mercadoPagoAccessToken: null })
    );
    expect(dto.mercadoPagoConfigured).toBe(false);
  });

  it("handles null settings with defaults", () => {
    const dto = getPublicBookingSettingsDto(null);
    expect(dto.enabled).toBe(true);
    expect(dto.mercadoPagoConfigured).toBe(false);
  });
});

describe("WhatsApp settings DTO shape", () => {
  it("uses whatsappTokenConfigured, not whatsappAccessToken", () => {
    const dto = {
      whatsappEnabled: true,
      whatsappPhoneNumberId: "phone-id",
      whatsappReturnTemplate: "Olá {nome}!",
      autoReturnEnabled: true,
      returnMessageDays: 20,
      lastBulkSendAt: null,
      whatsappTokenConfigured: true,
    };

    expect(dto).toHaveProperty("whatsappTokenConfigured");
    expect(dto).not.toHaveProperty("whatsappAccessToken");
    expect(typeof dto.whatsappTokenConfigured).toBe("boolean");
  });
});
