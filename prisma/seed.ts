import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, setHours, setMinutes, startOfDay } from "date-fns";

const prisma = new PrismaClient();

const DEFAULT_SERVICES = [
  { name: "Corte", price: 45, duration: 30, sortOrder: 1 },
  { name: "Barba", price: 35, duration: 20, sortOrder: 2 },
  { name: "Corte + Barba", price: 70, duration: 50, sortOrder: 3 },
  { name: "Pigmentação", price: 80, duration: 40, sortOrder: 4 },
  { name: "Sobrancelha", price: 25, duration: 15, sortOrder: 5 },
];

async function createTenantWithDefaults(
  name: string,
  slug: string,
  ownerEmail: string,
  ownerName: string,
  ownerPassword: string
) {
  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      phone: "(11) 99999-0000",
      plan: "PRO",
      settings: { create: {} },
      services: {
        create: DEFAULT_SERVICES,
      },
      users: {
        create: [
          {
            email: ownerEmail,
            name: ownerName,
            passwordHash,
            role: Role.OWNER,
          },
        ],
      },
    },
    include: { users: true, services: true },
  });

  return tenant;
}

async function main() {
  console.log("🌱 Seeding database...");

  const adminHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@cortecerto.com" },
    update: {},
    create: {
      email: "admin@cortecerto.com",
      name: "Admin Plataforma",
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const tenant1 = await createTenantWithDefaults(
    "Barbearia do João",
    "barbearia-joao",
    "joao@barbearia.com",
    "João Silva",
    "barbearia123"
  );

  const tenant2 = await createTenantWithDefaults(
    "Corte & Estilo",
    "corte-estilo",
    "maria@corteestilo.com",
    "Maria Santos",
    "barbearia123"
  );

  const barberHash = await bcrypt.hash("barbeiro123", 12);
  const barber1 = await prisma.user.create({
    data: {
      email: "carlos@barbearia.com",
      name: "Carlos Barbeiro",
      passwordHash: barberHash,
      role: Role.BARBER,
      tenantId: tenant1.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "pedro@barbearia.com",
      name: "Pedro Barbeiro",
      passwordHash: barberHash,
      role: Role.BARBER,
      tenantId: tenant1.id,
    },
  });

  const corteService = tenant1.services.find((s) => s.name === "Corte")!;
  const comboService = tenant1.services.find((s) => s.name === "Corte + Barba")!;

  const clientJoao = await prisma.client.create({
    data: {
      tenantId: tenant1.id,
      name: "João Cliente",
      phone: "11999887766",
      returnDays: 18,
    },
  });

  const clientCarlos = await prisma.client.create({
    data: {
      tenantId: tenant1.id,
      name: "Carlos Cliente",
      phone: "11988776655",
      returnDays: 22,
    },
  });

  const clientPedro = await prisma.client.create({
    data: {
      tenantId: tenant1.id,
      name: "Pedro Cliente",
      phone: "11977665544",
      returnDays: 20,
    },
  });

  const today = startOfDay(new Date());

  const appointments = [
    {
      tenantId: tenant1.id,
      clientId: clientJoao.id,
      serviceId: corteService.id,
      barberId: barber1.id,
      scheduledAt: setMinutes(setHours(today, 8), 0),
      duration: 30,
      price: corteService.price,
      paymentMethod: "PIX" as const,
      status: "COMPLETED" as const,
    },
    {
      tenantId: tenant1.id,
      clientId: clientCarlos.id,
      serviceId: comboService.id,
      barberId: barber1.id,
      scheduledAt: setMinutes(setHours(today, 9), 0),
      duration: 50,
      price: comboService.price,
      paymentMethod: "CASH" as const,
      status: "COMPLETED" as const,
    },
    {
      tenantId: tenant1.id,
      clientId: clientPedro.id,
      serviceId: corteService.id,
      barberId: barber1.id,
      scheduledAt: setMinutes(setHours(today, 11), 0),
      duration: 30,
      price: corteService.price,
      status: "SCHEDULED" as const,
    },
    {
      tenantId: tenant1.id,
      clientId: clientJoao.id,
      serviceId: corteService.id,
      barberId: barber1.id,
      scheduledAt: setMinutes(setHours(addDays(today, 1), 10), 0),
      duration: 30,
      price: corteService.price,
      status: "CONFIRMED" as const,
    },
  ];

  for (const apt of appointments) {
    await prisma.appointment.create({ data: apt });
  }

  await prisma.client.update({
    where: { id: clientJoao.id },
    data: { lastVisitAt: setMinutes(setHours(addDays(today, -22), 8), 0) },
  });

  await prisma.client.update({
    where: { id: clientCarlos.id },
    data: { lastVisitAt: setMinutes(setHours(addDays(today, -25), 9), 0) },
  });

  const clubeVip = await prisma.membershipPlan.create({
    data: {
      tenantId: tenant1.id,
      name: "Clube VIP",
      description: "4 cortes por mês de seg a sáb",
      price: 120,
      billingCycle: "MONTHLY",
      planType: "MONTHLY_LIMITED",
      maxVisitsPerMonth: 4,
      allowedWeekdays: "1,2,3,4,5,6",
      sortOrder: 1,
    },
  });

  await prisma.membershipPlan.create({
    data: {
      tenantId: tenant1.id,
      name: "Fidelidade 5+1",
      description: "A cada 5 cortes, barba grátis",
      price: 0,
      billingCycle: "ONE_TIME",
      planType: "LOYALTY",
      bonusAfterVisits: 5,
      bonusDescription: "Barba grátis",
      sortOrder: 2,
    },
  });

  await prisma.clientMembership.create({
    data: {
      tenantId: tenant1.id,
      clientId: clientJoao.id,
      planId: clubeVip.id,
      expiresAt: addDays(today, 30),
    },
  });

  await prisma.tenantSettings.update({
    where: { tenantId: tenant1.id },
    data: {
      whatsappEnabled: true,
      autoReturnEnabled: false,
      returnMessageDays: 20,
    },
  });

  console.log("✅ Seed completed!");
  console.log("");
  console.log("Contas de acesso:");
  console.log("  Admin plataforma: admin@cortecerto.com / admin123");
  console.log("  Barbearia João:   joao@barbearia.com / barbearia123");
  console.log("  Corte & Estilo:   maria@corteestilo.com / barbearia123");
  console.log("  Barbeiro Carlos:  carlos@barbearia.com / barbeiro123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
