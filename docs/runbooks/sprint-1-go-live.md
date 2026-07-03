# Sprint 1 — Go-Live technique

Exécution séquentielle. Ne pas passer au Sprint 2 tant que cette liste n'est pas ✅.

## §1 Secrets

### Vercel (web)

Project Settings → Environment Variables → **Production**

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WORKER_URL
WORKER_API_SECRET
UPSTASH_REDIS_REST_URL      (optionnel phase 1)
UPSTASH_REDIS_REST_TOKEN
```

### Railway (worker)

```
NODE_ENV=production
WORKER_PORT=3000
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
WORKER_API_SECRET           (identique à Vercel)
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
AI_ALLOW_MOCK=false
```

Générer secret : `openssl rand -hex 32`

## §2 Migrations

```bash
DATABASE_URL=postgresql://postgres:[pwd]@db.[project].supabase.co:5432/postgres pnpm db:migrate
```

Vérifier dans Supabase Table Editor : `organizations`, `clients`, `ai_request_logs`.

## §3 Backend Railway

```bash
curl https://[worker]/health
# → status ok, inngest true

curl -H "Authorization: Bearer $WORKER_API_SECRET" \
  -X POST https://[worker]/ai/inbox/classify \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"<uuid>","text":"Bonjour","messageId":"test-1"}'
# → 200 + intent
```

Sans secret → **401** attendu.

## §4 Frontend Vercel

```bash
curl https://[app]/api/health
# → status ok

# Navigateur :
# /signup → /onboarding → /dashboard
# /clients → CRUD smoke test
```

## §5 Checklist complète

[`production-checklist.md`](./production-checklist.md) — cocher toutes sections.

## §6 Bugs

Logger dans [`go-live-report.md`](../validation/go-live-report.md) §9.

**Gate :** remplir §1–§8 du rapport → signer Sprint 1.
