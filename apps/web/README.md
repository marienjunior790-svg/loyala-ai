# Web App

Next.js 15 App Router — dashboard shell.

# Sprint 1

## Setup Supabase

1. Run `supabase/migrations/001_core_tenant.sql`
2. Run `supabase/migrations/002_crm_clients.sql`
3. Copy `.env.example` → `apps/web/.env.local` and fill keys

## Flows

| Route | Description |
|-------|-------------|
| `/signup` | Create account |
| `/onboarding` | Create organization |
| `/login` | Sign in |
| `/dashboard` | Home |
| `/clients` | CRM list |
| `/clients/new` | Add client |


```bash
pnpm --filter web dev
```
