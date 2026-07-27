# Master Implementation Status — CorteCerto

Última atualização: 2026-07-27

Legenda: `pending` | `in_progress` | `done` | `partial` | `blocked_external`

| Fase | Item | Status | Arquivos / notas | Migrations | Testes | Riscos / pendências |
|------|------|--------|------------------|------------|--------|---------------------|
| 0 | Diagnóstico e baseline | done | `docs/SECURITY_BASELINE.md` | — | — | — |
| 1.1 | MP token não serializado | done | DTO + `newMercadoPagoAccessToken` | — | settings-dto | **Rotacionar tokens expostos** |
| 1.2 | WA token DTO | done | `whatsappTokenConfigured` | — | settings-dto | Idem |
| 1.3 | Criptografia AES-GCM | done | `src/lib/crypto/credentials.ts` | — | credentials | Chave obrigatória em prod |
| 1.4 | Auditoria client props | done | Grep: zero tokens em components | — | — | — |
| 2 | AuthZ central | done | `src/lib/authz` + JWT revalidate 60s | — | partial | Integration todos |
| 2 | Fix actions públicas críticas | done | booking finalize server-only; cron modules | — | — | — |
| 3 | Agenda idempotente + conflito | done | advisory lock + status transitions | sim | availability, transitions | Exclusion constraint PG opcional |
| 4 | Webhooks MP assinados | done | remove GET mutável; ProcessedWebhookEvent | sim | signature | Secret MP em prod |
| 5 | migrate deploy, índices | done | sem accept-data-loss | baseline | — | Resolve baseline em DB existente |
| 6 | Testes + CI | done | vitest + `.github/workflows/ci.yml` | — | 30 unit | E2E Playwright pendente |
| 7 | Logs + AuditLog | done | logger + writeAuditLog | sim | — | — |
| 8 | Agenda 2.0 | partial | horários reais, filtros, semana | sim | — | Drag/resize, recorrência UI incompletos |
| 9 | Financeiro operacional | done | caixa/comandas/estoque separado SaaS | sim | — | — |
| 10 | Comissões | done | regras + entries imutáveis | sim | — | — |
| 11 | Produtos/estoque | done | movimentos auditáveis | sim | — | — |
| 12 | Clube/recorrência | partial | MembershipRedemption + indicadores | sim | — | Cobrança recorrente MP clube |
| 13 | CRM + LGPD | partial | consent/export/anonymize/storage | sim | — | Storage S3/R2 externo |
| 14 | WhatsApp motor | partial | outbox + eventos + cron | sim | mocks | Meta templates/webhooks status |
| 15 | Relatórios | done | métricas SalePayment + ocupação | — | — | — |
| 16 | Multiunidade + permissões | partial | Location + Permission map | sim | — | UI multiunidade limitada |
| 17 | Fiscal abstrato | partial | NotConfiguredFiscalProvider | sim | — | Provider externo |
| 18 | IA assistente | partial | feature flag + tools read-only | — | — | AI_API_KEY |
| 19 | Diferenciais | partial | loyalty ledger + schema gift/coupon | sim | — | UI completa pendente |
| 20 | UX/a11y/perf | partial | nav clara; labels filtros | — | — | a11y audit completo |
| Docs | Arquitetura/segurança/deploy | done | `docs/*` + README | — | — | — |
| Final | Validação lint/type/test/build | done | todos passaram (lint warnings) | — | 30+7 | Sem push |

## Validação local (2026-07-27)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 (warnings only) |
| `npm run test:unit` | ✅ 30 passed |
| `npm run test:integration` | ✅ 1 passed, 6 todo (sem DATABASE_URL) |
| `npm run build` | ✅ exit 0 |

## Confirmações operacionais

- Push GitHub: **não realizado**
- Dados apagados: **não**
- `db push --accept-data-loss` em produção: **removido** (`vercel.json`, `package.json`)
- Tokens salvos serializados para cliente: **não** (confirmado por grep em components)
- Campo token vazio preserva credencial: **sim**
- Integrações não simulam sucesso em produção: **sim** (demo bloqueado em `NODE_ENV=production`)
