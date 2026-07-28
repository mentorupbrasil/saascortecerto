# Database Migrations

## Overview

This project uses **versioned Prisma migrations** only.

Never use in production:

```bash
prisma db push
prisma db push --accept-data-loss
```

Deploy command:

```bash
npx prisma migrate deploy
```

## Migration history (safe for legacy + empty)

| Migration | Purpose |
|-----------|---------|
| `20260727100000_legacy_baseline` | Exact schema as of commit `331af59` (pre-hardening, `db push` era) |
| `20260727100001_expand_operational_schema` | Additive forward migration to current `schema.prisma` + backfills + uniqueness |

The previous single `20260727000000_init_baseline` (full new schema) was **unsafe** for legacy databases and was replaced.

## Scenario A — empty database

```bash
createdb cortecerto_empty_test   # or CREATE DATABASE
export DATABASE_URL=postgresql://USER:PASS@HOST:5432/cortecerto_empty_test
npx prisma migrate deploy
npx tsx scripts/verify-schema.ts
```

Both migrations apply in order.

## Scenario B — legacy database (created with `db push` at schema `331af59`)

1. Confirm the live schema matches the legacy baseline (or restore a backup first).
2. Mark **only** the legacy baseline as already applied (do **not** re-run its SQL):

```bash
export DATABASE_URL=postgresql://USER:PASS@HOST:5432/your_legacy_db
npx prisma migrate resolve --applied 20260727100000_legacy_baseline
npx prisma migrate deploy
npx tsx scripts/verify-schema.ts
```

`migrate deploy` then applies **only** `20260727100001_expand_operational_schema`.

### Safety checks after legacy upgrade

- Existing tenants/clients/appointments still present
- New tables exist (`Location`, `Sale`, `AuditLog`, …)
- Primary `Location` backfilled per tenant
- Checkout snapshot columns backfilled when possible

## Schema verification

```bash
npx tsx scripts/verify-schema.ts
```

Compares the live database to `prisma/schema.prisma` via `prisma migrate diff`. Exit code `1` means drift.

## Regenerating diffs (maintainers)

```bash
node scripts/regen-migrations.js
```

Uses `prisma/schema.legacy.tmp.prisma` extracted from git commit `331af59`.

## Rollback notes

- Forward migration is additive (new enums/tables/columns/indexes). Prefer restore-from-backup for rollback of critical production failures.
- Do not delete columns/tables in emergency “fixes” with `db push --accept-data-loss`.

## Indexes / uniqueness added in forward migration

- Unique `mercadoPagoPaymentId` on signup and public booking checkouts
- Unique `CommissionEntry.saleItemId`
- Unique optional `idempotencyKey` on `CashMovement` and `StockMovement`
- `MembershipRedemption.idempotencyKey` unique (from schema create)
