# Observabilité — Loyala AI

Logs centralisés, monitoring uptime, alertes erreurs.

## Stack recommandée

| Couche | Outil | Intégration |
|--------|-------|-------------|
| **Erreurs** | Logs structurés JSON | `reportError` / `logStructured` (web + worker) |
| **Uptime** | [Better Stack](https://betterstack.com) ou UptimeRobot | Ping `/api/health` |
| **Logs app** | Vercel Logs + Railway logs | Natif |
| **Logs métier IA** | Supabase `ai_request_logs` | `@loyala/core-ai` |
| **Audit** | Supabase `domain_events` | `@loyala/events` + bridge Inngest |
| **Jobs** | Inngest dashboard | Natif |
| **Métriques produit** | `GET /api/metrics/ai` | RPC `get_tenant_ai_metrics` |

> **Sentry :** non déployé (décision P3). Voir `docs/decisions/2026-07-15-observability-without-sentry.md`. Option future si un DSN et un budget d’événements sont validés.

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

## Erreurs applicatives (actuel)

Les erreurs Next.js (`error.tsx`, `global-error.tsx`, `instrumentation.ts`) passent par `reportError` → logs JSON drainables (Vercel).

Pas de SDK Sentry en production MVP.

### Option future — Sentry

Si un DSN est provisionné :

```bash
pnpm --filter web add @sentry/nextjs
pnpm --filter worker add @sentry/node
```

Puis initialiser uniquement quand `SENTRY_DSN` est défini (éviter un stub env non câblé).

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
| Error log rate spike (Vercel/Railway) | Slack | P2 |
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
- Logs Vercel/Railway : erreurs par release / service
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
| Better Stack heartbeats | Selon plan |
