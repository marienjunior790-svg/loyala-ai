# Optimisation coûts cloud — Loyala AI

Cible : SaaS rentable à **milliers de restaurants** sans explosion des coûts IA et infra.

## Répartition coûts typique (estimation)

| Poste | % budget | Levier principal |
|-------|----------|------------------|
| **OpenAI / Anthropic** | 40–60 % | RFM déterministe, cache, batch |
| **Supabase** | 15–25 % | Pooler, index, retention logs |
| **Vercel** | 10–15 % | ISR, edge cache, preview limits |
| **Worker + Inngest** | 5–10 % | Concurrency, cron optimisé |
| **Upstash / monitoring** | 3–5 % | TTL courts rate limit |

---

## 1. Coûts IA (priorité #1)

Déjà implémenté dans `@loyala/core-ai` :

| Tactique | Économie estimée |
|----------|------------------|
| RFM sans LLM (regular/new) | ~60 % appels segmentation |
| Cache SHA-256 + TTL | ~30 % requêtes répétées |
| Prompts courts versionnés | ~20 % tokens input |
| `AI_MAX_COST_USD` plafond | Évite runaway |
| Batch campagnes concurrency 3–5 | Lisse les pics |
| Mock en dev (`AI_ALLOW_MOCK`) | 100 % dev local |

### Monitoring coût

```sql
-- Coût IA par org (30 jours)
SELECT organization_id, SUM(cost_usd) AS cost
FROM ai_request_logs
WHERE created_at > now() - interval '30 days'
GROUP BY organization_id
ORDER BY cost DESC
LIMIT 20;
```

**Alerte** : si coût org > $X/mois → review plan ou throttle.

### Plans SaaS

| Plan | Quota IA/mois | Action si dépassé |
|------|---------------|-------------------|
| Starter | 500 req | Cache only + email upgrade |
| Growth | 5 000 req | Soft throttle |
| Enterprise | Illimité | Monitoring dédié |

---

## 2. Supabase

- **Connection pooler** (port 6543) : évite surcharge connexions serverless Vercel
- **Index** : `(organization_id, created_at)` sur toutes tables logs — déjà en place
- **Retention** : purger `ai_request_logs` > 90 jours (job mensuel) sauf plan Enterprise
- **Storage** : pas de blobs en DB ; assets → Supabase Storage ou CDN
- **Staging** : projet Supabase séparé (free tier) — jamais prod pour tests

---

## 3. Vercel

- **Preview deployments** : limiter aux PR (pas chaque commit feature branch)
- **ISR** sur pages dashboard statiques si applicable
- **Edge** pour middleware auth (déjà)
- **Région unique** proche DB (évite latence + egress)
- **Analytics** : Vercel Analytics vs third-party selon plan

---

## 4. Worker / Railway

- **1 replica** suffit jusqu'à ~500 orgs actives
- **Scale horizontal** uniquement si CPU > 70 % sustained
- **Sleep** : ne pas utiliser sur worker prod (jobs Inngest)
- **Right-size** : 512 MB–1 GB RAM starter

---

## 5. Inngest

- Fan-out **par tenant** (déjà) — évite job monolithique
- Concurrency limit 5 — protège API OpenAI
- Pas de cron plus fréquent que daily sauf besoin métier
- Retry 3x max — évite boucles coûteuses

---

## 6. Upstash Redis

- Rate limit keys TTL 60 s — pas de stockage long terme
- Free tier : 10 K cmd/jour — suffisant early stage
- Upgrade si > 100 K req API/jour

---

## 7. Monitoring (coût vs valeur)

| Outil | Tier gratuit | Upgrade quand |
|-------|--------------|---------------|
| Sentry | 5 K events/mo | > 50 K users |
| UptimeRobot | 50 monitors | SLA clients |
| Better Stack | Trial | Équipe ops > 2 |

---

## Budget cible par phase

| Phase | Orgs | Coût infra/mois (hors IA variable) |
|-------|------|-------------------------------------|
| MVP | 0–50 | $50–150 |
| Growth | 50–500 | $200–800 |
| Scale | 500–5000 | $1 500–5 000 |

Coût IA variable : modéliser **$0.002–0.01 / requête** selon use case.

---

## Checklist mensuelle finance

- [ ] Review top 10 orgs par `cost_usd` IA
- [ ] Cache hit rate > 25 % ?
- [ ] Supabase disk usage trend
- [ ] Vercel bandwidth spike ?
- [ ] Inngest failed runs → coût retry
