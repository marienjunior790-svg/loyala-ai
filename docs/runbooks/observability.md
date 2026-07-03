# Observabilité — Loyala AI

Logs centralisés, monitoring uptime, alertes erreurs.

## Stack recommandée

| Couche | Outil | Intégration |
|--------|-------|-------------|
| **Erreurs** | [Sentry](https://sentry.io) | Next.js + worker SDK |
| **Uptime** | [Better Stack](https://betterstack.com) ou UptimeRobot | Ping `/api/health` |
| **Logs app** | Vercel Logs + Railway logs | Natif |
| **Logs métier IA** | Supabase `ai_request_logs` | `@loyala/core-ai` |
| **Audit** | Supabase `domain_events` | Web server actions |
| **Jobs** | Inngest dashboard | Natif |
| **Métriques produit** | `GET /api/metrics/ai` | RPC `get_tenant_ai_metrics` |

---

## Health checks

| Endpoint | Service | Attendu |
|----------|---------|---------|
| `GET /api/health` | Web (Vercel) | `200`, `status: ok` |
| `GET /health` | Worker | `200`, `status: ok`, `inngest: true` |

Configurer monitors **1 min interval**, alerte après **2 échecs consécutifs**.

### Better Stack (exemple)

```
Monitor 1: https://app.loyala.ai/api/health
Monitor 2: https://worker.loyala.ai/health
Heartbeat: Inngest (optionnel)
```

---

## Sentry (setup)

### Web — `apps/web`

```bash
pnpm --filter web add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Variables :

```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...          # CI only
NEXT_PUBLIC_SENTRY_DSN=...     # client errors
```

### Worker

```typescript
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
```

---

## Logs centralisés

### Structure log recommandée (JSON)

```json
{
  "level": "info",
  "service": "loyala-web",
  "requestId": "uuid",
  "organizationId": "uuid",
  "userId": "uuid",
  "message": "client.created",
  "timestamp": "ISO8601"
}
```

### Corrélation IA

Chaque requête IA → `request_id` dans `ai_request_logs` + console worker.

Requête debug :

```sql
SELECT * FROM ai_request_logs
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

### Export logs (scale)

- Vercel → Log Drain → Datadog / Axiom / Better Stack
- Supabase → pg_cron export `ai_request_logs` vers warehouse (Phase 2)

---

## Alertes erreurs

| Condition | Canal | Sévérité |
|-----------|-------|----------|
| Health down 2 min | Slack + email | P1 |
| Sentry error rate > 10/min | Slack | P2 |
| Inngest function failed 3x | Email | P2 |
| IA cost daily > $100 | Email finance | P3 |
| RLS test CI failed | Block deploy | P1 |

### Seuil coût IA (Supabase cron / Inngest)

```sql
SELECT SUM(cost_usd) AS daily_cost
FROM ai_request_logs
WHERE created_at > now() - interval '1 day';
```

---

## Dashboards

### Ops (interne)

- Inngest : runs, failures, duration
- Sentry : errors by release
- Supabase : DB size, connections, slow queries

### Produit (par tenant)

- `GET /api/metrics/ai` : requêtes, coût, latence, fallback rate
- Dashboard Loyala `/analytics` (data layer connecté)

---

## Runbook incident rapide

1. Vérifier `/api/health` + worker `/health`
2. Vercel/Railway status pages
3. Supabase status
4. Inngest status
5. Rollback L1 si deploy récent (< 1 h) — voir `rollback-strategy.md`

---

## Rétention

| Donnée | Rétention prod |
|--------|----------------|
| `ai_request_logs` | 90 jours (Starter), 1 an (Enterprise) |
| `domain_events` | 1 an |
| Vercel logs | Selon plan (7–30 jours) |
| Sentry events | 90 jours |
