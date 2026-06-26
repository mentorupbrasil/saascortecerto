"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { getPlanPrice, PLAN_LABELS } from "@/lib/plan-pricing";
import { generatePixCopiaECola } from "@/lib/pix";
import { getPlatformPixConfig, getPlatformSupportEmail } from "@/lib/platform-billing";
import {
  createMercadoPagoPreference,
  isMercadoPagoConfigured,
  isSignupDemoMode,
} from "@/lib/mercadopago";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Plan } from "@prisma/client";
import { addHours } from "date-fns";

const signupSchema = z.object({
  barbershopName: z.string().min(2),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  phone: z.string().optional(),
  plan: z.enum(["PRO", "CLUBE"]),
});

const DEFAULT_SERVICES = [
  { name: "Corte", price: 45, duration: 30, sortOrder: 1 },
  { name: "Barba", price: 35, duration: 20, sortOrder: 2 },
  { name: "Corte + Barba", price: 70, duration: 50, sortOrder: 3 },
  { name: "Pigmentação", price: 80, duration: 40, sortOrder: 4 },
  { name: "Sobrancelha", price: 25, duration: 15, sortOrder: 5 },
];

async function uniqueSlug(base: string) {
  let slug = slugify(base);
  let attempt = 0;

  while (attempt < 20) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    attempt++;
  }

  return `${slug}-${Date.now()}`;
}

export async function provisionTenantFromCheckout(checkoutId: string) {
  const checkout = await prisma.signupCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) throw new Error("Checkout não encontrado");
  if (checkout.status === "PAID" && checkout.tenantId) return checkout.tenantId;

  const existingUser = await prisma.user.findUnique({
    where: { email: checkout.ownerEmail.toLowerCase() },
  });
  if (existingUser) {
    throw new Error("Este e-mail já possui uma conta. Faça login.");
  }

  const slug = await uniqueSlug(checkout.slug || checkout.barbershopName);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: checkout.barbershopName,
        slug,
        phone: checkout.phone,
        plan: checkout.plan,
        active: true,
        billingEmail: checkout.ownerEmail.toLowerCase(),
        settings: { create: {} },
        services: { create: DEFAULT_SERVICES },
        users: {
          create: {
            email: checkout.ownerEmail.toLowerCase(),
            name: checkout.ownerName,
            passwordHash: checkout.passwordHash,
            role: "OWNER",
          },
        },
        subscriptionPayments: {
          create: {
            plan: checkout.plan,
            amount: checkout.amount,
            status: "PAID",
            dueDate,
            paidAt: new Date(),
            notes: "Primeira assinatura — cadastro via site",
          },
        },
      },
    });

    await tx.signupCheckout.update({
      where: { id: checkoutId },
      data: {
        status: "PAID",
        tenantId: created.id,
        paidAt: new Date(),
      },
    });

    return created;
  });

  return tenant.id;
}

export async function createSignupCheckout(formData: FormData) {
  const parsed = signupSchema.parse({
    barbershopName: formData.get("barbershopName"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPassword: formData.get("ownerPassword"),
    phone: formData.get("phone") || undefined,
    plan: formData.get("plan"),
  });

  const email = parsed.ownerEmail.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Este e-mail já está cadastrado. Faça login.");
  }

  const pending = await prisma.signupCheckout.findFirst({
    where: {
      ownerEmail: email,
      status: { in: ["PENDING", "AWAITING_PAYMENT"] },
    },
  });
  if (pending) {
    return { checkoutId: pending.id, redirectToPayment: true };
  }

  const plan = parsed.plan as Plan;
  const amount = getPlanPrice(plan);
  const passwordHash = await bcrypt.hash(parsed.ownerPassword, 12);
  const slug = slugify(parsed.barbershopName);

  const checkout = await prisma.signupCheckout.create({
    data: {
      plan,
      amount,
      barbershopName: parsed.barbershopName.trim(),
      slug,
      ownerName: parsed.ownerName.trim(),
      ownerEmail: email,
      passwordHash,
      phone: parsed.phone?.trim() || null,
      status: "AWAITING_PAYMENT",
      expiresAt: addHours(new Date(), 24),
    },
  });

  if (isSignupDemoMode()) {
    await provisionTenantFromCheckout(checkout.id);
    return { checkoutId: checkout.id, demoActivated: true };
  }

  if (isMercadoPagoConfigured()) {
    const preference = await createMercadoPagoPreference({
      checkoutId: checkout.id,
      planLabel: PLAN_LABELS[plan],
      amount,
      ownerEmail: email,
    });

    await prisma.signupCheckout.update({
      where: { id: checkout.id },
      data: { mercadoPagoPreferenceId: preference.preferenceId },
    });

    return {
      checkoutId: checkout.id,
      mercadoPagoUrl: preference.initPoint,
    };
  }

  return { checkoutId: checkout.id, redirectToPayment: true };
}

export async function getSignupCheckoutPublic(checkoutId: string) {
  const checkout = await prisma.signupCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) return null;

  const pix = getPlatformPixConfig();
  let copiaECola: string | null = null;
  if (pix) {
    copiaECola = generatePixCopiaECola({
      pixKey: pix.pixKey,
      merchantName: pix.merchantName,
      merchantCity: pix.merchantCity,
      amount: Number(checkout.amount),
      txId: checkout.id.slice(-20),
    });
  }

  return {
    id: checkout.id,
    status: checkout.status,
    plan: checkout.plan,
    planLabel: PLAN_LABELS[checkout.plan],
    amount: Number(checkout.amount),
    barbershopName: checkout.barbershopName,
    ownerEmail: checkout.ownerEmail,
    tenantId: checkout.tenantId,
    paidAt: checkout.paidAt?.toISOString() ?? null,
    mercadoPagoConfigured: isMercadoPagoConfigured(),
    pixConfigured: !!pix,
    pixKey: pix?.pixKey ?? null,
    copiaECola,
    supportEmail: getPlatformSupportEmail(),
  };
}

export async function confirmSignupPixPayment(checkoutId: string) {
  if (isMercadoPagoConfigured()) {
    throw new Error("Use o pagamento Mercado Pago para ativação automática.");
  }

  const checkout = await prisma.signupCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) throw new Error("Checkout não encontrado");
  if (checkout.status === "PAID") return { success: true, tenantId: checkout.tenantId };

  if (isSignupDemoMode()) {
    const tenantId = await provisionTenantFromCheckout(checkoutId);
    return { success: true, tenantId };
  }

  throw new Error(
    "Pagamento PIX manual aguarda confirmação. Configure MERCADOPAGO_ACCESS_TOKEN para liberação automática após pagamento."
  );
}

export async function processMercadoPagoWebhookPayment(paymentId: string) {
  const { fetchMercadoPagoPayment } = await import("@/lib/mercadopago");
  const { processBookingMercadoPagoPayment } = await import("@/lib/public-booking-actions");

  const bookingAppointmentId = await processBookingMercadoPagoPayment(paymentId);
  if (bookingAppointmentId) return bookingAppointmentId;

  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment?.external_reference) return null;
  if (payment.external_reference.startsWith("bk_")) return null;
  if (payment.status !== "approved") return null;

  const checkoutId = payment.external_reference;
  await prisma.signupCheckout.update({
    where: { id: checkoutId },
    data: { mercadoPagoPaymentId: String(payment.id) },
  });

  const tenantId = await provisionTenantFromCheckout(checkoutId);
  return tenantId;
}
