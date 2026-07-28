# Integrations — Cortzo

## Mercado Pago

**Status:** Partial — webhook signature validation implemented; tenant tokens encrypted.

| Feature | Status |
|---------|--------|
| Signup checkout (platform billing) | Implemented |
| Public booking payment | Implemented |
| Webhook signature (`x-signature`) | Implemented — `src/lib/integrations/mercadopago-webhook.ts` |
| Idempotent webhook processing | `ProcessedWebhookEvent` table |
| Tenant access token (encrypted) | `TenantSettings.mercadoPagoAccessToken` |

### Env vars

- `MERCADOPAGO_ACCESS_TOKEN` — platform token (signup)
- `MERCADOPAGO_WEBHOOK_SECRET` — webhook HMAC secret
- Per-tenant token via settings UI (encrypted at rest)

### Webhook endpoint

`POST /api/webhooks/mercadopago`

## WhatsApp (Meta Cloud API)

**Status:** Partial — send + return queue; demo mode for dev.

| Feature | Status |
|---------|--------|
| Return message queue | Implemented |
| Bulk send | Implemented |
| Template variables `{nome}`, `{dias}`, `{barbearia}` | Implemented |
| Cron auto-send | `/api/cron/whatsapp-return` |
| Token encryption | Implemented |
| Confirmation/reminder automations | Pending |
| Message outbox / retry | Schema ready, motor pending |

### Env vars

- `WHATSAPP_DEMO_MODE=true` — simulates sends without Meta API

### Tenant config

- Phone Number ID + Access Token in WhatsApp settings panel
- DTO exposes `whatsappTokenConfigured` only

## Fiscal (NF-e / NFC-e)

**Status:** Pending — abstract provider stub.

- `FiscalDocument` model in schema
- Provider integration not implemented
- External certificate/API required

## Storage (client photos)

**Status:** Partial — base64 in PostgreSQL.

| Approach | Status |
|----------|--------|
| Inline base64 in `Client.photoUrl` | Current (Vercel-compatible) |
| S3/R2 abstraction | Pending — env vars stubbed |

Env: `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_BASE_URL`

## AI assistant

**Status:** Pending.

Env: `AI_ENABLED`, `AI_API_KEY`

Planned: feature-flagged tools for booking suggestions, not yet wired.

## Cron / platform

| Integration | Auth | Route |
|-------------|------|-------|
| WhatsApp return | `CRON_SECRET` | `/api/cron/whatsapp-return` |
| Billing | `CRON_SECRET` | `/api/cron/billing` |

Configured in `vercel.json` cron schedule.

## Demo modes

| Flag | Effect |
|------|--------|
| `WHATSAPP_DEMO_MODE` | Simulated WA sends |
| `SIGNUP_DEMO_MODE` | Skip MP on signup |
| `BOOKING_DEMO_MODE` | Skip MP on public booking |

Disabled automatically when `NODE_ENV=production`.
