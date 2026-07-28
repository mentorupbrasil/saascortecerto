# Testing — Cortzo

## Stack

- **Vitest** — unit and integration tests
- **Playwright** — E2E (not yet configured; placeholder script)

## Running tests

```bash
npm run test:unit          # No database required — runs in CI
npm run test:integration   # Skips if DATABASE_URL unset
npm run test               # All Vitest tests
npm run typecheck
npm run lint
```

## Unit tests (`tests/unit/`)

Run without `DATABASE_URL`. Cover pure domain logic:

| File | Covers |
|------|--------|
| `credentials.test.ts` | Encrypt/decrypt roundtrip; DTO shape guards |
| `availability.test.ts` | Conflict detection, barber isolation, cancellation |
| `appointment-transitions.test.ts` | Status transition rules |
| `money.test.ts` | Cents rounding and formatting |
| `mercadopago-signature.test.ts` | Webhook signature validation |
| `settings-dto.test.ts` | Safe settings DTOs |

Test setup (`tests/setup.ts`) sets a dummy `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars).

## Integration tests (`tests/integration/`)

Require a real PostgreSQL database:

```bash
DATABASE_URL="postgresql://..." npm run test:integration
```

Tests use `describe.skipIf(!process.env.DATABASE_URL)` when DB is unavailable.

### Planned scenarios (`cross-tenant.test.ts`)

- Tenant A cannot access Tenant B resources
- Public booking slug isolation
- Barber scope filters
- Server action tenantId rejection

## E2E tests

Not yet implemented. Planned stack:

- Playwright
- Test database with seed
- `DATABASE_URL` + `NEXTAUTH_SECRET` in CI secrets

```bash
npm run test:e2e   # prints setup instructions
```

## Factories

`tests/factories/index.ts` — stub builders for tenants, users, settings. Extend for integration tests.

## CI

`.github/workflows/ci.yml` runs on pull requests / pushes to main:

1. `npm ci`
2. `npm audit --omit=dev --audit-level=critical` (fails the job; no continue-on-error)
3. `prisma generate`
4. `prisma migrate deploy` (empty database scenario)
5. `npm run lint`
6. `npm run typecheck`
7. `npm run test:unit` / `test:integration`
8. `npm run build`
9. `npm run db:verify`
10. Parallel job `legacy-migrate`: baseline SQL → seed → resolve → deploy → verify → Location backfill

## Writing new tests

- Prefer testing domain functions in `src/lib/domain/` without DB mocks.
- Mock `server-only` via `tests/mocks/server-only.ts` (configured in `vitest.config.ts`).
- Never assert on real token values in snapshots.
- Integration tests must clean up created rows or use transactions.

## Config

`vitest.config.ts` — path alias `@` → `./src`, includes `tests/unit` and `tests/integration`.
