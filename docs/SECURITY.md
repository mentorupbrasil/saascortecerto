# Security — CorteCerto

Baseline audit: [`SECURITY_BASELINE.md`](SECURITY_BASELINE.md)

## Secrets management

| Secret | Storage | Notes |
|--------|---------|-------|
| `NEXTAUTH_SECRET` | Env var | Session JWT signing |
| `CRON_SECRET` | Env var | Cron route auth |
| `CREDENTIALS_ENCRYPTION_KEY` | Env var | AES-256-GCM for tenant tokens |
| `MERCADOPAGO_WEBHOOK_SECRET` | Env var | Webhook signature validation |
| Tenant MP/WA tokens | DB (encrypted) | Never sent to client |

### CREDENTIALS_ENCRYPTION_KEY

- Production: **required** (64 hex chars recommended).
- Used by `src/lib/crypto/credentials.ts` for envelope format `ccenc:v1:...`.
- Legacy plaintext tokens are migrated via `npm run credentials:migrate`.

### Token rotation

If a token was exposed (client props, logs, Git history):

1. Revoke/regenerate at Mercado Pago or Meta Business.
2. Update in tenant settings UI.
3. Audit `AuditLog` for suspicious access.
4. Do **not** log token values during migration or debugging.

## Client exposure rules

Safe DTO fields only:

- `mercadoPagoConfigured: boolean` — not `mercadoPagoAccessToken`
- `whatsappTokenConfigured: boolean` — not `whatsappAccessToken`

Forms accept `newMercadoPagoAccessToken` / `newWhatsAppAccessToken` on write only.

## Webhook security

Mercado Pago webhooks validated via `verifyMercadoPagoSignature()` using `x-signature`, `x-request-id`, and `MERCADOPAGO_WEBHOOK_SECRET`.

Idempotency via `ProcessedWebhookEvent` table.

## HTTP headers

Configured in `next.config.ts`:

- Content-Security-Policy (Next.js compatible)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (restrict camera/mic/geo)
- frame-ancestors 'none' (via CSP)
- HSTS in production

## Rate limiting

Stub at `src/lib/security/rate-limit.ts`. Production should use Upstash Redis for durable limits across instances.

## AuthZ

Central helpers in `src/lib/authz/`. All tenant mutations must call `requireTenantUser()` and apply scope filters.

## Deploy safety

- **Never** use `prisma db push --accept-data-loss` in production.
- Use `prisma migrate deploy` only.
- See [`DEPLOYMENT.md`](DEPLOYMENT.md).

## CI

No real secrets in GitHub Actions — dummy values only for build/typecheck.

## Audit

Structured audit logging via `src/lib/audit/`. Sensitive values must not appear in metadata.
