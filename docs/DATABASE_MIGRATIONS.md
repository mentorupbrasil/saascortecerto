# Database Migrations — CorteCerto

## Overview

This project uses **Prisma Migrate** with PostgreSQL. Migration history lives in `prisma/migrations/`.

Baseline migration: `20260727000000_init_baseline` — full schema snapshot from initial `schema.prisma`.

## Commands

| Command | When to use |
|---------|-------------|
| `npm run db:migrate:dev` | Local dev — create/apply new migrations |
| `npm run db:migrate` | Production/CI — apply pending migrations only |
| `npm run db:push` | **Dev only** — quick schema sync without migration files |
| `npm run db:generate` | Regenerate Prisma client after schema change |

## Creating a new migration

```bash
# Edit prisma/schema.prisma, then:
npm run db:migrate:dev -- --name describe_change
```

Review generated SQL in `prisma/migrations/<timestamp>_describe_change/migration.sql` before committing.

## Production deploy

Vercel build runs:

```
prisma migrate deploy && prisma generate && next build
```

`migrate deploy`:

- Applies unapplied migrations in order
- Records state in `_prisma_migrations` table
- Fails safely if migration history conflicts

## Baseline for existing databases

If a database was created with `db push` before migrations existed:

1. Ensure schema matches `schema.prisma`
2. Mark baseline as applied without running SQL:

```bash
npx prisma migrate resolve --applied 20260727000000_init_baseline
```

Or on empty DB, `migrate deploy` applies the full baseline.

## Credentials migration (data, not schema)

Plaintext tokens in `TenantSettings` are encrypted separately:

```bash
CREDENTIALS_ENCRYPTION_KEY=... DATABASE_URL=... npm run credentials:migrate
```

See `scripts/migrate-credentials.ts`.

## Do not

- Run `prisma db push --accept-data-loss` in production
- Edit applied migration files — create a forward migration instead
- Delete `_prisma_migrations` rows manually unless recovering from a documented incident

## Lock file

`prisma/migrations/migration_lock.toml` pins provider to `postgresql`. Commit with migrations.
