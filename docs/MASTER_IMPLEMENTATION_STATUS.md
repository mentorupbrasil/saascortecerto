# Master Implementation Status — CorteCerto

Última atualização: 2026-07-27 (rodada P0)

Legenda: `pending` | `in_progress` | `done` | `partial` | `blocked`

| Item | Status | Notas |
|------|--------|-------|
| Migrations legado + forward | done | `20260727100000_legacy_baseline` + `20260727100001_expand_operational_schema`; verify OK empty+legacy |
| CI workflow real | done | `.github/workflows/ci.yml` com Postgres service; **status remoto ainda não confirmado** (sem push nesta rodada) |
| Testes integração PG | done | 12 testes reais, 0 todo/skip |
| HMAC Mercado Pago | done | `createHmac("sha256", secret)` oficial |
| Validação pagamento (status/BRL/valor/ref) | done | `payment-validation.ts` + uniqueness payment ID |
| Webhook idempotência | done | P2002 only; PROCESSING/PROCESSED/FAILED + reclaim |
| Concorrência agenda unificada | done | advisory lock int4; excludeCheckoutId; todos fluxos via atomic create |
| AuthZ Server Actions (DB) | done | mutações usam `@/lib/authz` |
| Integridade financeira | done | close idempotente; stock no close; Zod strict; refund perm |
| Clube resgate regras | partial | valida ACTIVE/expiry/limits/weekdays + redemption atômica; allowlists serviço/profissional/unidade **não existem no schema** |
| E2E | pending | script ainda é placeholder `echo` |
| Build remoto GitHub/Vercel | blocked | não validado nesta rodada (sem push) |

## Validação local P0 (PostgreSQL 16 descartável)

| Comando | Resultado |
|---------|-----------|
| migrate empty | ✅ |
| migrate legacy + dados | ✅ (tenant/cliente preservados; Location backfill; Sale existe) |
| verify-schema empty/legacy | ✅ |
| test:unit | ✅ 42 |
| test:integration | ✅ 12 |
| lint / typecheck / build | ver relatório final da sessão |

## Confirmações

- Push: **não realizado nesta rodada P0**
- `db push --accept-data-loss`: **não usado**
