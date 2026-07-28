# Security Baseline — Fase Zero

Data: 2026-07-27  
Produto: Cortzo  
Repositório: `mentorupbrasil/saascortecerto` (nome do repositório GitHub — não renomeado nesta fase)

## 1. Estado inicial do build / lint / types

| Comando | Resultado inicial |
|---------|-------------------|
| `npm ci` | OK (após instalação limpa) |
| `npm run lint` | Falhou antes de `npm ci` (`next` não encontrado). Reexecutar após instalação. |
| `npx tsc --noEmit` | Sem script `typecheck`; TypeScript local disponível após `npm ci`. |
| `npm run build` | Pendente após correções de segurança. |
| Migrations Prisma | **Inexistentes** — apenas `db push`. |
| `npm audit` | Vulnerabilidades em `next`, `next-auth`, `brace-expansion`, `js-yaml`, `postcss`. |

## 2. Segredos versionados

| Arquivo | Status |
|---------|--------|
| `.env` | Ausente no workspace |
| `.env.local` | Ausente |
| `.env.example` | Presente, apenas placeholders |
| Credenciais reais no Git | Não encontradas |

Variáveis sensíveis **não** devem usar prefixo `NEXT_PUBLIC_`.

## 3. Achados críticos (pré-correção)

### 3.1 Tokens expostos ao cliente

- `mercadoPagoAccessToken` enviado para `PublicBookingSettings` via `defaultValue`.
- `getWhatsAppSettings()` retorna model Prisma completo, incluindo `whatsappAccessToken`, serializado para Client Component.

### 3.2 Server Actions sem autenticação adequada

| Função | Risco |
|--------|-------|
| `confirmPublicBookingCheckout` | Confirma pagamento/agendamento sem prova de pagamento |
| `provisionTenantFromCheckout` | Provisiona tenant sem auth |
| `recordMembershipVisit` | IDOR cross-tenant |
| `getAgendaOnlineItems(tenantId)` | Aceita tenant arbitrário; expõe PII |
| `processBulkReturnForTenant` | Disparo WA por tenantId sem auth |
| `runBillingCron` / `runAutoReturnCron` | Exportados como actions (rota cron tem Bearer) |
| `getTenantBillingOverview` | IDOR potencial |
| `processMercadoPagoWebhookPayment` | Sem validação de assinatura no caller |

### 3.3 Webhook Mercado Pago

- Sem validação de `x-signature`.
- `GET` muta estado (confirma pagamentos).
- Aceita payment ID do cliente sem consulta confiável + idempotência estruturada.

### 3.4 Deploy inseguro

```
prisma db push --accept-data-loss
```

Presente em `package.json` (`vercel-build`) e `vercel.json` (`buildCommand`).

### 3.5 Autenticação JWT

- Role/tenant/active congelados no JWT por até 30 dias.
- Usuário desativado continua autenticado até expirar o token.

### 3.6 Integridade da agenda

- `updateAppointmentStatus` aplica side-effects mesmo sem garantir que o update ocorreu.
- Completar duas vezes pode consumir benefício / atualizar visita duplicadamente.
- Conflito de horário validado apenas antes do insert (race condition).

### 3.7 Dinheiro / timezone

- Schema usa `Decimal` (bom), mas camada de app usa `Number`/`parseFloat`.
- Sem timezone IANA por tenant; `setHours` depende do TZ do servidor.

### 3.8 Fotos

- Upload armazena data URL (base64) em `Client.photoUrl` no PostgreSQL.

## 4. Rotas API auditadas

| Rota | Métodos | Auth | Mutação em GET? |
|------|---------|------|-----------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth | N/A |
| `/api/health` | GET | Nenhuma | Não (info disclosure leve) |
| `/api/clients/by-phone` | GET | Session + tenant | Não |
| `/api/upload/client-photo` | POST, DELETE | Session + tenant | Não |
| `/api/cron/billing` | GET | Bearer `CRON_SECRET` | Sim (cron) |
| `/api/cron/whatsapp-return` | GET | Bearer `CRON_SECRET` | Sim (cron) |
| `/api/webhooks/mercadopago` | POST, **GET** | **Nenhuma assinatura** | **Sim — crítico** |

## 5. Auditoria de dependências (resumo)

Severidades altas/críticas reportadas em:

- `next` (várias CVEs App Router / SSRF / DoS)
- `next-auth` (critical)
- `brace-expansion`, `js-yaml`, `postcss`

Plano: atualizar versões compatíveis sem upgrade cego de major; documentar residual.

## 6. Critérios de saída da Fase Zero

- [x] Diagnóstico documentado
- [x] Sem alteração de `.env` com credenciais reais
- [x] Checklist master criado
- [ ] Correções iniciadas nas fases seguintes
