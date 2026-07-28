/**
 * Safe legacy preflight before marking baseline applied / migrate deploy.
 * Read-only. Does NOT mutate the database.
 *
 *   npx tsx scripts/verify-legacy-preflight.ts
 *
 * Env:
 *   DATABASE_URL (required)
 *   BACKUP_CONFIRMED=1 after Neon branch/snapshot
 *   ALLOW_NON_LEGACY=1 to report-only when shape is ambiguous
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

function maskDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "(unknown)",
      port: u.port || "",
      database: (u.pathname.replace(/^\//, "").split("?")[0] || "(unknown)"),
    };
  } catch {
    return { host: "(unparseable)", port: "", database: "(unparseable)" };
  }
}

function queryJson<T>(databaseUrl: string, sql: string): T {
  const helper = path.join(process.cwd(), "scripts", "_query-json.cjs");
  const out = execFileSync(process.execPath, [helper], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl, PREFLIGHT_SQL: sql },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out) as T;
}

const COUNT_TABLES = [
  "Tenant",
  "User",
  "Client",
  "Service",
  "Appointment",
  "TenantSettings",
  "SignupCheckout",
  "PublicBookingCheckout",
  "SubscriptionPayment",
] as const;

const REQUIRED_LEGACY_TABLES = [
  ...COUNT_TABLES,
  "MembershipPlan",
  "ClientMembership",
  "WhatsAppMessage",
];

const FORWARD_HINTS = [
  "Sale",
  "Location",
  "AuditLog",
  "ProcessedWebhookEvent",
  "CashSession",
];

function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const masked = maskDatabaseUrl(databaseUrl);
  console.log("=== Legacy preflight (read-only) ===");
  console.log(
    `host=${masked.host} port=${masked.port || "(default)"} database=${masked.database}`
  );
  if (masked.host === "127.0.0.1" || masked.host === "localhost") {
    console.log("NOTE: DATABASE_URL points to localhost — not production.");
  }

  const tables = queryJson<Array<{ tablename: string }>>(
    databaseUrl,
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  ).map((r) => r.tablename);
  console.log(`public_tables=${tables.length}`);

  const counts: Record<string, number> = {};
  for (const table of COUNT_TABLES) {
    if (!tables.includes(table)) {
      counts[table] = -1;
      continue;
    }
    const rows = queryJson<Array<{ n: number }>>(
      databaseUrl,
      `SELECT COUNT(*)::int AS n FROM "${table}"`
    );
    counts[table] = Number(rows[0]?.n ?? 0);
  }
  console.log("counts:", JSON.stringify(counts));

  const missingLegacy = REQUIRED_LEGACY_TABLES.filter((t) => !tables.includes(t));
  const forwardPresent = FORWARD_HINTS.filter((t) => tables.includes(t));
  console.log("missing_legacy_tables:", missingLegacy);
  console.log("forward_tables_present:", forwardPresent);

  let applied: string[] = [];
  const migrationsTable = tables.includes("_prisma_migrations");
  if (migrationsTable) {
    applied = queryJson<Array<{ migration_name: string }>>(
      databaseUrl,
      `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`
    ).map((r) => r.migration_name);
  }
  console.log("prisma_migrations_table:", migrationsTable);
  console.log("applied_migrations:", applied);

  let duplicateSignupPayments = 0;
  let duplicateBookingPayments = 0;
  if (tables.includes("SignupCheckout")) {
    duplicateSignupPayments = Number(
      queryJson<Array<{ n: number }>>(
        databaseUrl,
        `SELECT COUNT(*)::int AS n FROM (
           SELECT "mercadoPagoPaymentId" FROM "SignupCheckout"
           WHERE "mercadoPagoPaymentId" IS NOT NULL
           GROUP BY 1 HAVING COUNT(*) > 1
         ) d`
      )[0]?.n ?? 0
    );
  }
  if (tables.includes("PublicBookingCheckout")) {
    duplicateBookingPayments = Number(
      queryJson<Array<{ n: number }>>(
        databaseUrl,
        `SELECT COUNT(*)::int AS n FROM (
           SELECT "mercadoPagoPaymentId" FROM "PublicBookingCheckout"
           WHERE "mercadoPagoPaymentId" IS NOT NULL
           GROUP BY 1 HAVING COUNT(*) > 1
         ) d`
      )[0]?.n ?? 0
    );
  }
  console.log("duplicate_signup_payment_ids:", duplicateSignupPayments);
  console.log("duplicate_booking_payment_ids:", duplicateBookingPayments);

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ counts, tables: [...tables].sort(), applied }))
    .digest("hex")
    .slice(0, 16);
  console.log("preflight_fingerprint:", fingerprint);

  const looksEmpty =
    tables.length === 0 ||
    (tables.length === 1 && tables[0] === "_prisma_migrations");
  const looksAlreadyMigrated =
    forwardPresent.length >= 3 &&
    applied.includes("20260727100000_legacy_baseline") &&
    applied.includes("20260727100001_expand_operational_schema");
  const looksLegacy =
    missingLegacy.length === 0 &&
    forwardPresent.length === 0 &&
    !applied.includes("20260727100001_expand_operational_schema");

  console.log("assessment:", { looksEmpty, looksLegacy, looksAlreadyMigrated });

  if (duplicateSignupPayments > 0 || duplicateBookingPayments > 0) {
    console.error("BLOCKED: duplicate mercadoPagoPaymentId values.");
    process.exit(2);
  }
  if (looksAlreadyMigrated) {
    console.log("OK: baseline+forward already applied.");
    process.exit(0);
  }
  if (looksEmpty) {
    console.log("OK: empty DB — run prisma migrate deploy only (do not resolve).");
    process.exit(0);
  }
  if (!looksLegacy && process.env.ALLOW_NON_LEGACY !== "1") {
    console.error(
      "BLOCKED: schema is not pure legacy (331af59). Do NOT migrate resolve."
    );
    process.exit(3);
  }
  if (process.env.BACKUP_CONFIRMED !== "1") {
    console.error(
      "BLOCKED: create a Neon branch/snapshot, then set BACKUP_CONFIRMED=1."
    );
    process.exit(4);
  }

  console.log("READY for exactly-once:");
  console.log("  npx prisma migrate resolve --applied 20260727100000_legacy_baseline");
  console.log("  npx prisma migrate deploy");
  console.log("  npm run db:verify");
}

main();
