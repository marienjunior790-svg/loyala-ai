# Worker — Loyala AI

HTTP API + Inngest pour l'automation IA multi-tenant.

## Démarrage

```bash
cp apps/worker/.env.example apps/web/.env.local  # ou copier depuis root .env.example
pnpm dev:worker
```

Le worker charge automatiquement `.env`, `.env.local`, `apps/web/.env.local`.

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Santé + config IA |
| GET/POST | `/api/inngest` | Handler Inngest |
| GET | `/ai/stats?organizationId=` | Métriques IA tenant |
| POST | `/ai/campaigns/birthday` | Campagnes anniversaire |
| POST | `/ai/campaigns/loyalty` | Relances fidélité |
| … | `/ai/*` | Voir `ai-routes.ts` |

## Inngest

| Job | Schedule / Event | Action |
|-----|------------------|--------|
| `loyala-daily-campaign-dispatcher` | `0 8 * * *` | Fan-out par organisation |
| `loyala-birthday-campaign` | `loyala/campaign.birthday.run` | IA anniversaire |
| `loyala-inactive-relaunch` | `loyala/campaign.inactive.run` | Relance inactifs |

Dev local : `INNGEST_DEV=true` + [Inngest Dev Server](https://www.inngest.com/docs/local-development).

Prod : configurer `INNGEST_EVENT_KEY` et `INNGEST_SIGNING_KEY`, pointer Inngest vers `https://worker.example.com/api/inngest`.

## Validation env

Fail-fast au boot via `parseWorkerEnv()` — clés API requises en production.
