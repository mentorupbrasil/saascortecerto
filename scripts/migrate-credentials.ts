/**
 * One-time migration: encrypt legacy plaintext credentials in TenantSettings.
 *
 * Usage: CREDENTIALS_ENCRYPTION_KEY=... DATABASE_URL=... npm run credentials:migrate
 *
 * Never logs token values.
 */
import { PrismaClient } from "@prisma/client";
import {
  encryptCredential,
  isEncryptedCredential,
} from "../src/lib/crypto/credentials";

const prisma = new PrismaClient();

type CredentialField = "whatsappAccessToken" | "mercadoPagoAccessToken";

async function migrateField(
  id: string,
  field: CredentialField,
  value: string | null
): Promise<boolean> {
  if (!value || isEncryptedCredential(value)) return false;

  const encrypted = encryptCredential(value);
  await prisma.tenantSettings.update({
    where: { id },
    data: { [field]: encrypted },
  });
  return true;
}

async function main() {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    console.error("CREDENTIALS_ENCRYPTION_KEY is required.");
    process.exit(1);
  }

  const rows = await prisma.tenantSettings.findMany({
    select: {
      id: true,
      tenantId: true,
      whatsappAccessToken: true,
      mercadoPagoAccessToken: true,
    },
  });

  let migrated = 0;

  for (const row of rows) {
    const wa = await migrateField(
      row.id,
      "whatsappAccessToken",
      row.whatsappAccessToken
    );
    const mp = await migrateField(
      row.id,
      "mercadoPagoAccessToken",
      row.mercadoPagoAccessToken
    );
    if (wa || mp) {
      migrated += 1;
      console.log(
        `Encrypted credentials for tenantSettings ${row.id} (tenant ${row.tenantId})`
      );
    }
  }

  console.log(`Done. Updated ${migrated} row(s).`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
