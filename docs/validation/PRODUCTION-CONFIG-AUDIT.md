# Production configuration — audit & sync guide

**Project Vercel:** `marienjunior790-svg1/loyala-ai-web`  
**Production URL:** https://loyala-ai-web.vercel.app

## Variables présentes sur Vercel (audit 2026-07-07)

| Variable | Production | Preview |
|----------|------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `NEXT_PUBLIC_DEMO_WHATSAPP` | ✅ | ✅ |
| `AUTH_DEBUG` | ✅ (à désactiver) | ✅ |

## Variables manquantes sur Vercel (bloquent `status: ok`)

| Variable | Priorité | Action |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | P1 | `https://loyala-ai-web.vercel.app` |
| `WORKER_URL` | P0 | URL Railway après déploiement worker |
| `WORKER_API_SECRET` | P0 | Même secret que Railway (min 16 chars) |
| `SUPABASE_SERVICE_ROLE_KEY` | P1 | Supabase → Settings → API |
| `UPSTASH_REDIS_REST_URL` | P2 | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | P2 | Upstash console |
| `RESEND_API_KEY` | P2 | Resend dashboard |
| `RESEND_FROM_EMAIL` | P2 | ex. `Loyala AI <noreply@loyala.ai>` |
| `BETTERSTACK_HEARTBEAT_URL` | P3 | Optionnel |

## Variables Railway (worker) — à créer

Voir `apps/worker/railway.toml` + `apps/worker/Dockerfile`.

```
NODE_ENV=production
WORKER_PORT=3000
NEXT_PUBLIC_SUPABASE_URL=        (identique Vercel)
SUPABASE_SERVICE_ROLE_KEY=       (identique Vercel)
WORKER_API_SECRET=               (identique Vercel)
OPENAI_API_KEY=                  (ou ANTHROPIC_API_KEY)
AI_ALLOW_MOCK=false
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

## Commandes

```bash
# Vérifier routes + health
node scripts/verify-production.mjs

# Vérifier migrations (après DATABASE_URL ou service role)
pnpm db:migrate   # applique 001–013
node scripts/check-migrations.mjs

# Déployer worker Railway (après railway login)
cd apps/worker && npx @railway/cli up

# Ajouter une variable Vercel (exemple)
echo "https://loyala-ai-web.vercel.app" | npx vercel env add NEXT_PUBLIC_APP_URL production
```

## Secrets partagés (doivent être identiques)

| Secret | Vercel | Railway |
|--------|--------|---------|
| `WORKER_API_SECRET` | ✅ requis | ✅ requis |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | recommandé | ✅ requis |

Les clés IA (`OPENAI_*`, `ANTHROPIC_*`) sont **worker-only** — le web n'en a pas besoin.
