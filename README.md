# CorteCerto ✂️

SaaS multi-tenant para gestão de barbearias — agenda, clientes, faturamento, clube de assinatura e automações WhatsApp.

## Stack

- **Next.js 15** (App Router)
- **PostgreSQL** (Neon recommended)
- **Prisma ORM** with versioned migrations
- **NextAuth** (email/senha)
- **Tailwind CSS 4**
- **Vitest** for unit/integration tests

## Multi-tenant

Cada barbearia é um **Tenant**. Todo dado (clientes, serviços, agendamentos) tem `tenant_id`.

| Papel | Escopo |
|-------|--------|
| **SUPER_ADMIN** | Painel admin — cria barbearias |
| **OWNER** | Tudo da barbearia + equipe |
| **MANAGER** | Agenda, clientes, serviços |
| **BARBER** | Próprios agendamentos |
| **RECEPTIONIST** | Agenda e clientes |

## Setup local

```bash
cp .env.example .env
# Edit DATABASE_URL, NEXTAUTH_SECRET, CREDENTIALS_ENCRYPTION_KEY

npm install
npm run db:migrate:dev   # first time: apply migrations
npm run db:seed          # optional demo data
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Verificação TypeScript |
| `npm run lint` | ESLint |
| `npm run test` | Todos os testes Vitest |
| `npm run test:unit` | Testes unitários (sem DB) |
| `npm run test:integration` | Testes de integração (requer `DATABASE_URL`) |
| `npm run test:e2e` | Placeholder — ver `docs/TESTING.md` |
| `npm run db:migrate` | `prisma migrate deploy` (produção/CI) |
| `npm run db:migrate:dev` | Criar/aplicar migrations em dev |
| `npm run db:seed` | Dados demo |
| `npm run credentials:migrate` | Criptografa tokens legados em plaintext |

## Segurança

- **Nunca** commite `.env` ou tokens reais.
- `CREDENTIALS_ENCRYPTION_KEY` é obrigatória em produção — tokens de WhatsApp e Mercado Pago são criptografados com AES-256-GCM.
- **Rotacione tokens** se algum valor sensível foi exposto (logs, client props, Git). Após rotacionar na Meta/MP, atualize no painel e rode `credentials:migrate` se necessário.
- DTOs expostos ao cliente usam flags booleanas (`mercadoPagoConfigured`, `whatsappTokenConfigured`) — nunca o token em si.
- Deploy usa `prisma migrate deploy` — **não** use `db push --accept-data-loss` em produção.

Documentação detalhada: [`docs/SECURITY.md`](docs/SECURITY.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deploy (Vercel + Neon)

1. Conecte o repo no Vercel (Framework: Next.js)
2. Configure variáveis de ambiente (ver `.env.example`)
3. Build command: `prisma migrate deploy && prisma generate && next build` (já em `vercel.json`)
4. Aplique migrations no Neon antes ou durante o primeiro deploy
5. Gere `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars) e guarde com segurança

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para rollback e checklist.

## CI

Pull requests disparam `.github/workflows/ci.yml`: lint, typecheck, unit tests, build, audit (critical).

## Contas demo (após seed)

| Email | Senha | Papel |
|-------|-------|-------|
| admin@cortecerto.com | admin123 | Admin plataforma |
| joao@barbearia.com | barbearia123 | Dono |
| carlos@barbearia.com | barbeiro123 | Barbeiro |

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Visão geral do sistema |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Baseline de segurança |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploy e rollback |
| [`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md) | Migrations Prisma |
| [`docs/TESTING.md`](docs/TESTING.md) | Estratégia de testes |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | MP, WhatsApp, pendências |
