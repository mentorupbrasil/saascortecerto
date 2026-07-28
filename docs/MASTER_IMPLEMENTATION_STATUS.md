# Master Implementation Status — Cortzo

Última atualização: 2026-07-27 (rodada P0.1 final)

Legenda: `pending` | `in_progress` | `done` | `partial` | `blocked`

| Item | Status | Notas |
|------|--------|-------|
| Preflight produção + backup Neon | blocked | `DATABASE_URL` local ≠ produção; backup não confirmado → migrate prod **não executada** |
| Scripts preflight/verify seguros | done | `db:preflight`, `db:verify` via `execFileSync` (sem URL em shell string) |
| Migrations legado + forward + lease | done | baseline + expand + `20260728000000_webhook_event_lease` |
| Webhook event key + lease | done | notificationId / payloadHash; lease 10min; reclaim condicional; só P2002 |
| Testes webhook (11) + cross-tenant actions | done | integração real PG; sem todo/skip |
| CI empty + legacy migrate | done | `quality` + `legacy-migrate`; audit critical sem continue-on-error |
| Vercel `npm ci` | done | `vercel.json` installCommand |
| Critical deps (`next-auth`) | done | 4.24.15 |
| High deps (postcss/sharp via Next) | partial | overrides tentados; residual se Next pin incompatível |
| E2E | pending | script ainda placeholder |
| Build remoto GitHub/Vercel | blocked | sem push nesta rodada |
| Migração produção P3005 | blocked | aguarda URL prod + backup Neon + `BACKUP_CONFIRMED=1` |

## Validação local P0.1

| Comando | Resultado |
|---------|-----------|
| migrate empty | ✅ 3 migrations |
| migrate legacy + dados | ✅ resolve baseline → deploy → verify; Location=1; Appointment=1 preservado |
| test:unit | ✅ 47 |
| test:integration | ✅ 28 |
| lint | ✅ (warnings unused-vars pré-existentes) |
| typecheck | ✅ |
| build | ✅ |
| npm audit --omit=dev | ✅ 0 |
| npm audit (com dev) | ⚠ 9 high só em eslint/minimatch (dev); sem critical |

## Confirmações

- Push: **não realizado nesta rodada P0.1**
- `db push` / `migrate reset` / `audit fix --force`: **não usados**
- Produção: **pending** até backup + preflight READY
- Versões: `next@15.5.22`, `next-auth@4.24.15`, overrides `postcss@8.5.23` + `sharp@0.35.3`

