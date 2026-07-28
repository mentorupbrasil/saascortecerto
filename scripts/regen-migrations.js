const { execSync } = require("child_process");
const fs = require("fs");

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://u:p@localhost:5432/db";

const legacy = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.legacy.tmp.prisma --script",
  { encoding: "utf8" }
);
fs.writeFileSync(
  "prisma/migrations/20260727100000_legacy_baseline/migration.sql",
  legacy,
  "utf8"
);

let forward = execSync(
  "npx prisma migrate diff --from-schema-datamodel prisma/schema.legacy.tmp.prisma --to-schema-datamodel prisma/schema.prisma --script",
  { encoding: "utf8" }
);

// Remove fragile default rewrites for WhatsApp template (encoding noise)
forward = forward.replace(
  /,\r?\n\s*ALTER COLUMN\s+"whatsappReturnTemplate"\s+SET DEFAULT\s+'[^']*'/g,
  ""
);
forward = forward.replace(
  /\r?\nALTER TABLE "TenantSettings" ALTER COLUMN "whatsappReturnTemplate" SET DEFAULT '[^']*';?\r?\n/g,
  "\n"
);

if (!/CREATE TABLE "ProcessedWebhookEvent"[\s\S]*?"status"/.test(forward)) {
  forward = forward.replace(
    `"processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,`,
    `"processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result" TEXT,`
  );
}

const extra = `
-- Drop non-unique payment indexes replaced by unique constraints
DROP INDEX IF EXISTS "PublicBookingCheckout_mercadoPagoPaymentId_idx";

-- Idempotency / uniqueness (P0)
CREATE UNIQUE INDEX IF NOT EXISTS "SignupCheckout_mercadoPagoPaymentId_key" ON "SignupCheckout"("mercadoPagoPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PublicBookingCheckout_mercadoPagoPaymentId_key" ON "PublicBookingCheckout"("mercadoPagoPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionEntry_saleItemId_key" ON "CommissionEntry"("saleItemId");

ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_idempotencyKey_key" ON "CashMovement"("idempotencyKey");

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey");

-- Backfill primary location
INSERT INTO "Location" ("id", "tenantId", "name", "slug", "active", "isPrimary", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), t."id", 'Unidade principal', 'principal', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Location" l WHERE l."tenantId" = t."id" AND l."isPrimary" = true
);

UPDATE "PublicBookingCheckout" c
SET
  "serviceName" = COALESCE(c."serviceName", s."name"),
  "serviceDuration" = COALESCE(c."serviceDuration", s."duration"),
  "servicePrice" = COALESCE(c."servicePrice", s."price"),
  "currency" = COALESCE(c."currency", 'BRL')
FROM "Service" s
WHERE s."id" = c."serviceId"
  AND (c."serviceName" IS NULL OR c."serviceDuration" IS NULL OR c."servicePrice" IS NULL);
`;

fs.writeFileSync(
  "prisma/migrations/20260727100001_expand_operational_schema/migration.sql",
  forward.trimEnd() + "\n" + extra,
  "utf8"
);

const legacyCheck = fs.readFileSync(
  "prisma/migrations/20260727100000_legacy_baseline/migration.sql",
  "utf8"
);
const m = legacyCheck.match(/whatsappReturnTemplate[^\n]+/);
console.log("legacy snippet:", m ? m[0].slice(0, 140) : "missing");
console.log("has Já:", legacyCheck.includes("Já faz"));
console.log(
  "forward status:",
  /"status" TEXT NOT NULL DEFAULT 'PROCESSING'/.test(
    fs.readFileSync(
      "prisma/migrations/20260727100001_expand_operational_schema/migration.sql",
      "utf8"
    )
  )
);
