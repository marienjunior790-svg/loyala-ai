# Smoke tests production — commandes rapides

## Architecture prod (clarification)

| Service | Hébergeur | Health endpoint |
|---------|-----------|-----------------|
| **backend-api** (Express + Prisma) | **Railway** | `GET /api/v1/health` |
| **loyala web** (Next.js) | **Vercel** | `GET /api/health` |

> `backend-api-nine-wine.vercel.app` — Express sur Vercel, crash `reflect-metadata` connu.  
> **Non bloquant** si l'API prod = Railway uniquement.

---

## §1 Base de données

Exécuter dans Supabase SQL Editor : [`scripts/verify-supabase-go-live.sql`](../../scripts/verify-supabase-go-live.sql)

Attendu : 10 lignes dans `_prisma_migrations`, RLS actif.

---

## §2 Endpoints

```bash
# Backend Railway (validé commit 0794bcb)
curl -s https://backend-api-production-222b.up.railway.app/api/v1/health
# → {"status":"ok","service":"backend-api","db":"connected",...}

# Frontend Loyala Vercel (projet web Next.js)
curl -s -w "\nHTTP:%{http_code}\n" https://[loyala-app]/api/health

# Auth + CRM : navigateur ou API backend-api selon routes exposées
```

---

## §3 Audit après CRUD client

```sql
SELECT event_type, organization_id, payload, created_at
FROM domain_events
WHERE event_type IN ('client.created','client.updated','client.deleted')
ORDER BY created_at DESC
LIMIT 10;
```

---

## §5 Tag Go-Live

```bash
git tag -a v1.0.0-go-live -m "Sprint 1 Go-Live validated"
git push origin v1.0.0-go-live
```

Rapport : [`go-live-report.md`](./go-live-report.md)
