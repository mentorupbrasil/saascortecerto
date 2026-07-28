# Architecture — Cortzo

## Overview

Cortzo is a multi-tenant SaaS for barbershop management. Each tenant (barbershop) has isolated data scoped by `tenantId`.

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Router                   │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Marketing  │  Tenant App  │ Public Book  │  Admin     │
│   /          │  /agenda...  │ /agendar/[slug]│ /admin   │
├──────────────┴──────────────┴──────────────┴────────────┤
│              Server Actions + API Routes                 │
├─────────────────────────────────────────────────────────┤
│  Domain layer (availability, appointments, billing)      │
├─────────────────────────────────────────────────────────┤
│  Prisma ORM ──► PostgreSQL (Neon)                        │
└─────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| UI | `src/app`, `src/components` | Pages, forms, client components |
| Actions | `src/lib/*-actions.ts` | Server actions, auth checks |
| Domain | `src/lib/domain/` | Pure business rules (availability, status transitions) |
| Integrations | `src/lib/integrations/` | Webhooks, external APIs |
| Infrastructure | `src/lib/prisma.ts`, `src/lib/crypto/` | DB, encryption, logging |

## Multi-tenancy

- Every tenant-scoped model has `tenantId`.
- `requireTenantUser()` + `authz` filters enforce row-level isolation.
- SUPER_ADMIN bypasses tenant scope for platform admin routes only.

## Key flows

### Public booking

1. Client visits `/agendar/[slug]`
2. Availability computed via `src/lib/domain/availability.ts`
3. Optional Mercado Pago checkout → webhook confirms payment
4. Appointment created with `origin: PUBLIC`

### Appointment lifecycle

Status transitions are enforced in `src/lib/domain/appointment-status.ts`. `COMPLETED` is terminal — no re-complete.

### Credentials

Tenant WhatsApp and Mercado Pago tokens stored encrypted in `TenantSettings`. DTOs expose `*Configured` booleans only.

### Cron jobs

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/whatsapp-return` | Daily 10:00 | Return messages |
| `/api/cron/billing` | Daily 06:00 | Subscription billing |

Protected by `Authorization: Bearer CRON_SECRET`.

## Timezone

Tenant timezone stored in `TenantSettings.timeZone` (IANA). Slot generation uses `src/lib/timezone/`.

## Money

Application logic uses integer cents (`src/lib/money/`). Prisma `Decimal(12,2)` at DB boundary.

## Pending modules

See `docs/MASTER_IMPLEMENTATION_STATUS.md` for fiscal, storage, AI, and full CRM scope.
