# Loyala AI

Monorepo Turborepo — **Blueprint v2.1** — Sprint 0 scaffold.

## Structure

```
loyala-ai/
├── apps/
│   ├── web/                 # Next.js 15 App Router
│   └── worker/              # Jobs & consumers (skeleton)
├── packages/
│   ├── core-iam/            # RBAC + tenant context
│   ├── core-ai/             # AI orchestrator (skeleton)
│   ├── db/                  # Supabase clients
│   ├── events/              # Domain event envelope
│   ├── ui/                  # Design tokens + primitives
│   └── validation/          # Shared Zod
├── supabase/migrations/     # PostgreSQL + RLS
└── docs/
    ├── blueprint/           # Blueprint v2.1
    ├── adr/                 # ADR 001–008
    └── runbooks/
```

## Prérequis

- Node.js ≥ 20
- pnpm ≥ 9

## Démarrage

```bash
pnpm install
pnpm dev          # web :3000
pnpm dev:worker   # worker :3001
```

## Supabase

Guide complet : [`docs/runbooks/production-setup.md`](./docs/runbooks/production-setup.md).

Migrations (ordre) :

1. `001_core_tenant.sql`
2. `002_crm_clients.sql`
3. `003_ai_logs.sql`
4. `004_client_date_of_birth.sql`
5. `005_ai_metrics_rpc.sql`

```bash
DATABASE_URL=postgresql://... pnpm db:migrate
```

Ou exécuter chaque fichier dans le **SQL Editor** Supabase.

## Gouvernance

Voir [`docs/blueprint/GOVERNANCE.md`](./docs/blueprint/GOVERNANCE.md).

## Production (DevOps)

| Document | Description |
|----------|-------------|
| [`docs/validation/SPRINT-PLAN.md`](./docs/validation/SPRINT-PLAN.md) | **Sprint 1–3 validation (priorité actuelle)** |
| [`docs/validation/go-live-report.md`](./docs/validation/go-live-report.md) | Rapport Go-Live à signer |
| [`docs/runbooks/sprint-1-go-live.md`](./docs/runbooks/sprint-1-go-live.md) | Exécution Go-Live technique |
| [`docs/runbooks/sprint-2-functional-validation.md`](./docs/runbooks/sprint-2-functional-validation.md) | Parcours produit |

Variables : [`.env.example`](./.env.example)

## Scripts

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Next.js web app |
| `pnpm dev:worker` | Worker HTTP + Inngest |
| `pnpm db:migrate` | Appliquer migrations Supabase |
| `pnpm build` | Build all |
| `pnpm test` | Vitest |
| `pnpm typecheck` | TypeScript |
