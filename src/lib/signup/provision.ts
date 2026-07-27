import "server-only";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const DEFAULT_SERVICES = [
  { name: "Corte", price: 45, duration: 30, sortOrder: 1 },
  { name: "Barba", price: 35, duration: 20, sortOrder: 2 },
  { name: "Corte + Barba", price: 70, duration: 50, sortOrder: 3 },
  { name: "Pigmentação", price: 80, duration: 40, sortOrder: 4 },
  { name: "Sobrancelha", price: 25, duration: 15, sortOrder: 5 },
];

async function uniqueSlug(base: string) {
  const slug = slugify(base);
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
