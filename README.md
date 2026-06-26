# CorteCerto ✂️

SaaS multi-tenant para gestão de barbearias — agenda, clientes, faturamento e automações.

## Stack

- **Next.js 15** (App Router)
- **PostgreSQL** (Neon)
- **Prisma ORM**
- **NextAuth** (login com email/senha)
- **Tailwind CSS 4**

## Multi-tenant (várias barbearias, dados isolados)

Cada barbearia é um **Tenant**. Todo dado (clientes, serviços, agendamentos) tem `tenant_id`.

| Papel | O que vê |
|-------|----------|
| **SUPER_ADMIN** | Painel admin — cria barbearias e donos |
| **OWNER** | Tudo da barbearia dele + gerencia equipe |
| **MANAGER** | Agenda, clientes, serviços, equipe |
| **BARBER** | Só os próprios agendamentos |
| **RECEPTIONIST** | Agenda e clientes da barbearia |

Barbearia X **nunca** vê dados da Barbearia Y.

## Setup local

```bash
npm install
npm run db:setup    # cria tabelas + seed demo
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="gere-um-secret-aleatorio"
```

## Contas demo (após seed)

| Email | Senha | Papel |
|-------|-------|-------|
| admin@cortecerto.com | admin123 | Admin plataforma |
| joao@barbearia.com | barbearia123 | Dono — Barbearia do João |
| maria@corteestilo.com | barbearia123 | Dono — Corte & Estilo |
| carlos@barbearia.com | barbeiro123 | Barbeiro (só vê agenda dele) |

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Sincroniza schema com Neon |
| `npm run db:seed` | Popula dados demo |
| `npm run db:setup` | push + seed |

## Deploy (Vercel + Neon)

1. Conecte o repo no Vercel
2. Configure `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
3. Rode `npm run db:push` uma vez (local ou CI)
4. Deploy

## WhatsApp — cobrança de retorno

- Fila automática de clientes que passaram do intervalo (padrão 20 dias)
- **Envio em massa** com um clique para todos de uma vez
- Envio individual por cliente
- Template personalizável: `{nome}`, `{dias}`, `{barbearia}`
- Histórico de mensagens
- Cron automático: `GET /api/cron/whatsapp-return` com header `Authorization: Bearer CRON_SECRET`

Configure na tela **WhatsApp** ou via `.env`:

```env
WHATSAPP_DEMO_MODE="true"   # simula envios (sem API Meta)
# Para produção:
WHATSAPP_DEMO_MODE="false"
# + Phone Number ID e Access Token no painel WhatsApp
```

## Clube de assinatura

O dono cria planos flexíveis:

| Tipo | Exemplo |
|------|---------|
| Mensal limitado | R$ 120/mês · 4 cortes · seg-sáb |
| Mensal ilimitado | R$ 200/mês · cortes à vontade |
| Pacote | R$ 400 · 10 visitas |
| Fidelidade | A cada 5 cortes → barba grátis |

Inscreva clientes, controle visitas usadas, bônus automático ao concluir atendimento.

## Foto do cliente

Upload JPG/PNG/WebP até 500KB no cadastro do cliente. Armazenado no banco (funciona na Vercel).

## Próximos passos

- [ ] Link público de agendamento (`/agendar/[slug]`)
- [ ] PIX recorrente para clube
- [ ] Confirmação e lembrete automático pré-agendamento
