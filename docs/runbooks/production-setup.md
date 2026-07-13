# Mise en production — Loyala AI

Guide pas-à-pas pour déployer l'application multi-tenant (Supabase + Vercel + Worker/Inngest).

## Étape 1 — Créer la base de données (Supabase)

La base est le cœur de l'application. Toute donnée métier est scopée par `organization_id` (tenant).

### 1.1 Créer le projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Récupérer dans **Project Settings → API** :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (**serveur uniquement**, jamais côté navigateur)

### 1.2 Activer l'authentification

Dans **Authentication → Providers** :

- **Email** : activé (login / signup Loyala)
- **Google** (optionnel) : selon besoin produit
- Configurer **Site URL** et **Redirect URLs** :
  - Dev : `http://localhost:3000/auth/callback`
  - Prod : `https://votre-domaine.com/auth/callback`

### 1.3 Exécuter les migrations (ordre strict)

| Ordre | Fichier | Contenu |
|-------|---------|---------|
| 1 | `001_core_tenant.sql` | `organizations`, `roles`, `organization_members`, `domain_events`, RLS |
| 2 | `002_crm_clients.sql` | Table `clients` + RLS |
| 3 | `003_ai_logs.sql` | Table `ai_request_logs` + RLS |
| 4 | `004_client_date_of_birth.sql` | Colonne `date_of_birth` (campagnes anniversaire) |
| 5 | `005_ai_metrics_rpc.sql` | RPC `get_tenant_ai_metrics` (dashboard) |

**Option A — SQL Editor** (manuel)  
Coller chaque fichier dans **SQL Editor → Run**, dans l'ordre.

**Option B — Script CLI** (recommandé)

```bash
# Récupérer DATABASE_URL dans Project Settings → Database → Connection string (URI)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres pnpm db:migrate
```

Le script `scripts/apply-migrations.mjs` applique uniquement les migrations non encore enregistrées.

### 1.4 Vérifier le RLS

Toutes les tables multi-tenant ont **Row Level Security** activé :

| Table | RLS | Isolation |
|-------|-----|-----------|
| `organizations` | ✅ | Membres actifs uniquement |
| `organization_members` | ✅ | `auth.user_org_ids()` |
| `roles` | ✅ | Lecture contrôlée |
| `domain_events` | ✅ | Par `organization_id` |
| `clients` | ✅ | Par `organization_id` |
| `ai_request_logs` | ✅ | SELECT par org ; INSERT via service role (worker) |

Helper SQL : `auth.user_org_ids()` retourne les orgs de l'utilisateur connecté.

Tests locaux :

```bash
pnpm test                    # inclut rls-policies.test.ts (statique)
pnpm test:rls                # intégration (nécessite secrets Supabase)
```

---

## Étape 2 — Comprendre la structure de la base

### Tables actuelles (Sprint 1–2)

| Table | Rôle | Clé tenant |
|-------|------|------------|
| `organizations` | Entreprises clientes (tenants) | `id` |
| `auth.users` | Utilisateurs (géré par Supabase Auth) | — |
| `organization_members` | Rôles et appartenance | `organization_id` |
| `roles` | Définition RBAC (`org_owner`, `org_viewer`, …) | scope org |
| `clients` | Clients CRM des restaurants | `organization_id` |
| `domain_events` | Journal d'audit métier | `organization_id` |
| `ai_request_logs` | Logs requêtes IA (tokens, coût) | `organization_id` |

> Loyala utilise **`organization_id`** (pas `tenant_id`) — même concept, nom aligné sur le schéma.

### Tables prévues (sprints suivants)

| Table | Sprint | Rôle |
|-------|--------|------|
| `campaigns` | 3 | Campagnes marketing WhatsApp |
| `notifications` | 3+ | Notifications in-app / push |
| `messages` | 2+ | Inbox client |

Les migrations futures suivront le même pattern : `organization_id` + RLS + index `(organization_id, created_at)`.

---

## Étape 3 — Variables d'environnement

Copier `.env.example` vers `apps/web/.env.local` :

```bash
cp .env.example apps/web/.env.local
```

### Web (Vercel / `.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (safe côté client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (onboarding, admin) |

### Worker + IA

| Variable | Description |
|----------|-------------|
| `WORKER_PORT` | Port HTTP worker (défaut `3001`) |
| `OPENAI_API_KEY` | GPT-4o (provider primaire) |
| `ANTHROPIC_API_KEY` | Claude Sonnet (fallback) |
| `AI_PRIMARY_PROVIDER` | `openai` |
| `AI_FALLBACK_PROVIDER` | `anthropic` |
| `AI_ALLOW_MOCK` | `true` en dev sans clés API |
| `INNGEST_EVENT_KEY` | Clé Inngest (prod) |
| `INNGEST_SIGNING_KEY` | Signature webhooks Inngest |
| `INNGEST_DEV` | `true` avec Inngest Dev Server |

Validation fail-fast : `packages/validation/src/env.ts` — le worker refuse de démarrer en prod si les clés manquent.

**Ne jamais committer** `.env.local` ni les clés `service_role` / API.

---

## Étape 4 — Déployer l'application

### Architecture cible

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │     │    Worker    │     │   Inngest   │
│  (Next.js)  │     │  :3001 HTTP  │◀───▶│  cron/jobs  │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       └─────────┬─────────┘
                 ▼
         ┌───────────────┐
         │   Supabase    │
         │  Auth + DB    │
         └───────────────┘
```

### Vercel (frontend)

1. Connecter le repo GitHub à Vercel.
2. **Root directory** : racine du monorepo.
3. **Build** : `pnpm build` (Turbo build `web`).
4. Ajouter toutes les variables `NEXT_PUBLIC_*` et `SUPABASE_SERVICE_ROLE_KEY` dans **Settings → Environment Variables**.
5. Déployer.

### Worker (arrière-plan)

Le worker expose :

- `GET /health`
- `POST /ai/*` — automation IA
- `GET/POST /api/inngest` — handler Inngest

Déployer sur Railway, Fly.io, Render ou VPS :

```bash
cd apps/worker
pnpm build && pnpm start
```

Configurer Inngest pour pointer vers `https://[worker-url]/api/inngest`.

### Inngest

Jobs automatiques :

| Job | Schedule | Action |
|-----|----------|--------|
| Dispatcher quotidien | `0 8 * * *` | Fan-out par organisation |
| Anniversaires | event `loyala/campaign.birthday.run` | Campagnes IA |
| Inactifs | event `loyala/campaign.inactive.run` | Relance fidélité |

Dev local : `INNGEST_DEV=true` + [Inngest Dev Server](https://www.inngest.com/docs/local-development).

---

## Étape 5 — Vérifications avant ouverture

Checklist de validation :

| # | Vérification | Comment tester |
|---|--------------|----------------|
| 1 | Authentification | Signup → login → logout sur `/login` |
| 2 | Création d'organisation | Onboarding `/onboarding` (pays, fuseau, devise) |
| 3 | Isolation tenants (RLS) | `pnpm test:rls` avec secrets Supabase |
| 4 | Dashboard chargé | `/dashboard` — KPIs + métriques IA |
| 5 | CRM opérationnel | CRUD clients `/clients` |
| 6 | Logs IA enregistrés | Appel worker `/ai/inbox/classify` → ligne dans `ai_request_logs` |
| 7 | Métriques dashboard | `GET /api/metrics/ai` (authentifié) |
| 8 | Jobs Inngest | Déclencher manuellement ou attendre cron 08:00 |
| 9 | Typecheck + tests CI | `pnpm typecheck && pnpm test` |
| 10 | Sauvegardes Supabase | Activer backups auto (plan Supabase) |
| 11 | Monitoring | Logs Vercel + Supabase + Inngest dashboard |

### Commandes locales rapides

```bash
pnpm install
pnpm dev              # web :3000
pnpm dev:worker       # worker :3001

# Test IA (mock si AI_ALLOW_MOCK=true)
curl -X POST http://localhost:3001/ai/inbox/classify \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"<uuid>","text":"Bonjour","messageId":"m1"}'

# Santé worker
curl http://localhost:3001/health
```

---

## Références

- [ADR-009 — AI Automation Engine](../adr/009-ai-automation-engine.md)
- [ADR-010 — Message Router + Channel Adapter](../adr/010-messaging-router-channel-adapter.md)
- [packages/core-ai/README.md](../../packages/core-ai/README.md)
- [apps/worker/README.md](../../apps/worker/README.md)
- [GOVERNANCE.md](../blueprint/GOVERNANCE.md)
