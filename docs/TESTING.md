# Testing — CorteCerto

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

`.github/workflows/ci.yml` runs on pull requests:

1. `npm ci`
2. `prisma generate`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run test:unit`
6. `npm run build` (dummy env vars)
7. `npm audit --audit-level=critical` (continue-on-error)

## Writing new tests

- Prefer testing domain functions in `src/lib/domain/` without DB mocks.
- Mock `server-only` via `tests/mocks/server-only.ts` (configured in `vitest.config.ts`).
- Never assert on real token values in snapshots.
- Integration tests must clean up created rows or use transactions.

## Config

`vitest.config.ts` — path alias `@` → `./src`, includes `tests/unit` and `tests/integration`.
