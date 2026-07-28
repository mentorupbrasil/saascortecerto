# Deployment — Cortzo

## Target platform

- **App:** Vercel (Next.js)
- **Database:** Neon PostgreSQL

## Build command

```
prisma migrate deploy && prisma generate && next build
```

Configured in `vercel.json` and `package.json` (`vercel-build`).

### Why not `db push --accept-data-loss`?

`db push --accept-data-loss` can drop columns or data when schema diverges. Production deploys must use versioned migrations (`prisma migrate deploy`) for predictable, reversible schema changes.

## First deploy checklist

1. Create Neon database and copy `DATABASE_URL`
2. Set Vercel environment variables (see `.env.example`)
3. Generate production secrets:
   - `NEXTAUTH_SECRET` (32+ random chars)
   - `CRON_SECRET` (32+ random chars)
   - `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars)
4. Deploy — migrations run automatically during build
5. Optionally run `npm run db:seed` locally against staging only
6. If migrating from plaintext tokens: `npm run credentials:migrate`

## Required production env vars

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `NEXTAUTH_SECRET` | Yes |
| `NEXTAUTH_URL` | Yes |
| `CRON_SECRET` | Yes |
| `CREDENTIALS_ENCRYPTION_KEY` | Yes |
| `MERCADOPAGO_WEBHOOK_SECRET` | Yes (if MP webhooks enabled) |

## Migrations on deploy

`prisma migrate deploy` applies pending migrations from `prisma/migrations/` without prompting. It does **not** generate new migrations — those are created in dev with `npm run db:migrate:dev`.

## Rollback

### Application rollback

Redeploy a previous Vercel deployment via the Vercel dashboard. No data migration needed if schema unchanged.

### Schema rollback

Prisma has no automatic down migrations. Options:

1. **Forward-fix:** Create a new migration that reverses the change (`db:migrate:dev` locally, commit, deploy).
2. **Restore DB backup:** Neon point-in-time restore, then redeploy matching app version.

Never run `db push --accept-data-loss` against production to "fix" a bad migration.

## Cron routes

Vercel cron configured in `vercel.json`:

- `GET /api/cron/whatsapp-return` — 10:00 UTC daily
- `GET /api/cron/billing` — 06:00 UTC daily

Both require `Authorization: Bearer $CRON_SECRET`.

## Post-deploy verification

- [ ] `/api/health` returns OK
- [ ] Login works
- [ ] Public booking page loads for a tenant slug
- [ ] MP webhook test event accepted (staging)
- [ ] No secrets in browser network tab (check settings DTOs)

## Staging vs production

Use separate Neon branches/databases and distinct encryption keys. Do not share `CREDENTIALS_ENCRYPTION_KEY` across environments if databases are copied independently.
