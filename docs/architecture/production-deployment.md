# Architecture de déploiement production — Loyala AI

SaaS multi-tenant cible : **milliers de restaurants**, isolation stricte par `organization_id`.

## Vue d'ensemble

```
                         ┌─────────────────────────────────────────┐
                         │           CDN / Edge (Vercel)            │
                         │  Next.js 15 · SSR · API Routes · ISR     │
                         └───────────────┬─────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
     ┌────────────────┐        ┌─────────────────┐       ┌─────────────────┐
     │    Supabase    │        │  Worker (Railway│       │     Inngest     │
     │  Auth + Postgres│◀──────│  / Fly / Render)│◀─────▶│  Cron + retries │
     │  RLS + Realtime │        │  AI + /api/inngest│       │  Fan-out tenant │
     └────────────────┘        └─────────────────┘       └─────────────────┘
              │
              ▼
     ┌────────────────┐        ┌─────────────────┐
     │  Upstash Redis │        │  Observability   │
     │  Rate limiting │        │  Sentry · Logs   │
     └────────────────┘        │  Uptime · Alerts │
                               └─────────────────┘
```

## Composants

| Composant | Hébergeur | Rôle | Scaling |
|-----------|-----------|------|---------|
| **Web** | Vercel | UI, auth session, API légères | Auto horizontal (serverless) |
| **Worker** | Railway / Fly | IA, Inngest, batch campagnes | Réplicas + concurrency Inngest |
| **Database** | Supabase PostgreSQL | Source de vérité, RLS | Connection pooler, read replica (Pro) |
| **Auth** | Supabase Auth | JWT, OAuth | Géré Supabase |
| **Jobs** | Inngest | Anniversaires, inactifs | Fan-out par tenant, retry |
| **Cache / RL** | Upstash Redis | Rate limit, cache edge | Serverless Redis |
| **Secrets** | Vercel + Railway env | Clés API | Jamais en repo |

## Flux requête utilisateur

1. Client → Vercel Edge → Middleware (session Supabase, rate limit `/api/*`)
2. Server Component / Route Handler → Supabase client (JWT utilisateur, RLS actif)
3. Appels IA lourds → Worker (`WORKER_URL`) avec `WORKER_API_SECRET`
4. Worker → `@loyala/core-ai` → OpenAI/Anthropic → log `ai_request_logs`

## Multi-tenant

- **RLS** sur toutes les tables métier (`auth.user_org_ids()`)
- Cookie `loyala_org_id` pour contexte org côté web
- Worker : jamais de requête cross-tenant ; jobs Inngest 1 event = 1 `organizationId`
- Service role **uniquement** worker + migrations (Blueprint T5)

## Régions recommandées

| Service | Région | Raison |
|---------|--------|--------|
| Vercel | `cdg1` (Paris) ou `fra1` | Latence Afrique de l'Ouest / Europe |
| Supabase | `eu-west-1` ou proche clients | Co-localisation DB |
| Worker | Même région que Supabase | Latence IA + DB |
| Upstash | `eu-west-1` | Rate limit co-localisé |

## Environnements

| Env | Branche | URL | Usage |
|-----|---------|-----|-------|
| **Production** | `main` | `app.loyala.ai` | Clients payants |
| **Preview** | PR | `*.vercel.app` | Review + QA |
| **Staging** | `staging` | `staging.loyala.ai` | Tests E2E, migrations |
| **Local** | — | `localhost:3000` | Dev (`AI_ALLOW_MOCK=true`) |

## CI/CD (résumé)

Voir `.github/workflows/ci.yml` et `cd.yml` :

1. **PR** → typecheck, tests, build, RLS integration (si secrets)
2. **Merge main** → Vercel deploy auto + smoke health
3. **Migrations** → `pnpm db:migrate` manuel ou CI job staging-first

## Scaling (milliers de restaurants)

### Phase 1 — 0–500 orgs

- Vercel Pro, Supabase Pro, 1 worker Railway
- Upstash Redis pay-as-you-go
- Inngest free/pro

### Phase 2 — 500–5 000 orgs

- Supabase connection pooler (port 6543)
- 2–4 worker replicas, Inngest concurrency ↑
- Read replica Supabase pour analytics
- Cache IA TTL agressif (`AI_CACHE_TTL_SECONDS`)

### Phase 3 — 5 000+ orgs

- Sharding logique par région (orgs `country_code`)
- Queue dédiée campagnes (Inngest throttling par plan)
- Supabase Enterprise ou Postgres dédié
- CDN assets statiques, edge config Vercel

## Sécurité production (résumé)

- HTTPS everywhere (Vercel + Railway)
- Headers sécurité (`vercel.json`)
- Rate limiting API (Upstash)
- `WORKER_API_SECRET` sur routes IA worker
- RLS + validation Zod + audit `domain_events`
- Rotation clés trimestrielle (Supabase, OpenAI, Inngest)

## Observabilité

| Signal | Outil | Alertes |
|--------|-------|---------|
| Erreurs app | Sentry | Slack / email |
| Uptime web | Better Stack / UptimeRobot | Pager si `/api/health` down |
| Uptime worker | Heartbeat Inngest + `/health` | Idem |
| Logs IA | `ai_request_logs` + Supabase logs | Coût > seuil |
| Métriques | `GET /api/metrics/ai` | Dashboard interne |

## Références

- [`production-checklist.md`](../runbooks/production-checklist.md)
- [`rollback-strategy.md`](../runbooks/rollback-strategy.md)
- [`cost-optimization.md`](../runbooks/cost-optimization.md)
- [`observability.md`](../runbooks/observability.md)
