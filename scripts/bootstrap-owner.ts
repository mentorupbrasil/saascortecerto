/**
 * One-shot bootstrap: creates a single tenant + OWNER so the platform owner
 * can log in without going through paid signup.
 *
 * Usage:
 *   BOOTSTRAP_EMAIL=voce@email.com BOOTSTRAP_PASSWORD='sua-senha' npx tsx scripts/bootstrap-owner.ts
 *
 * Optional:
 *   BOOTSTRAP_NAME="Seu Nome"
 *   BOOTSTRAP_SHOP="Minha Barbearia"
 *   BOOTSTRAP_SLUG=minha-barbearia
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Defina ${name} antes de rodar o bootstrap`);
  }
  return value;
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function main() {
  const email = requireEnv("BOOTSTRAP_EMAIL").toLowerCase();
  const password = requireEnv("BOOTSTRAP_PASSWORD");
  const name = process.env.BOOTSTRAP_NAME?.trim() || "Dono";
  const shop = process.env.BOOTSTRAP_SHOP?.trim() || "Minha Barbearia";
  const slugBase = process.env.BOOTSTRAP_SLUG?.trim() || slugify(shop) || "minha-barbearia";

  if (password.length < 6) {
    throw new Error("BOOTSTRAP_PASSWORD deve ter pelo menos 6 caracteres");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        active: true,
        name: existing.name || name,
      },
    });
    console.log(`Senha atualizada para usuário existente: ${email}`);
    console.log(`Role atual: ${existing.role}`);
    return;
  }

  let slug = slugBase;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slugBase : `${slugBase}-${i + 1}`;
    const taken = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!taken) {
      slug = candidate;
      break;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 365);

  const tenant = await prisma.tenant.create({
    data: {
      name: shop,
      slug,
      plan: "PRO",
      active: true,
      billingEmail: email,
      settings: { create: {} },
      services: {
        create: [
          { name: "Corte", price: 45, duration: 30, sortOrder: 1 },
          { name: "Barba", price: 35, duration: 20, sortOrder: 2 },
          { name: "Corte + Barba", price: 70, duration: 50, sortOrder: 3 },
        ],
      },
      users: {
        create: {
          email,
          name,
          passwordHash,
          role: Role.OWNER,
          active: true,
        },
      },
      subscriptionPayments: {
        create: {
          plan: "PRO",
          amount: 0,
          status: "PAID",
          dueDate,
          paidAt: new Date(),
          notes: "Bootstrap do dono da plataforma (sem cobrança)",
        },
      },
    },
  });

  console.log("Conta criada:");
  console.log(`  Barbearia: ${shop} (/${slug})`);
  console.log(`  Email:     ${email}`);
  console.log(`  Senha:     (a que você passou em BOOTSTRAP_PASSWORD)`);
  console.log(`  TenantId:  ${tenant.id}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
