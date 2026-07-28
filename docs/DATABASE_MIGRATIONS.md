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

## Production (non-empty DB / Vercel P3005)

When Vercel reports `P3005 The database schema is not empty`, the production database already has the legacy schema from `db push` and has **not** recorded Prisma migrations.

### Safe sequence

1. Point `DATABASE_URL` at production (do not log the full URL).
2. Create a Neon **branch** or snapshot backup.
3. Run read-only preflight:

```bash
npx tsx scripts/verify-legacy-preflight.ts
# After backup:
BACKUP_CONFIRMED=1 npx tsx scripts/verify-legacy-preflight.ts
```

4. Only if preflight prints `READY`:

```bash
npx prisma migrate resolve --applied 20260727100000_legacy_baseline
npx prisma migrate deploy
npm run db:verify
```

Do **not** re-execute the baseline SQL against existing tables.
Do **not** use `db push`, `db push --accept-data-loss`, or `migrate reset`.

Forward migrations currently include:

- `20260727100001_expand_operational_schema`
- `20260728000000_webhook_event_lease`

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
