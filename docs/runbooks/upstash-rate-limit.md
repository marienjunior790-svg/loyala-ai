# Upstash Redis — rate limiting production (P0)

Distributed rate limiting for `/api/ai/*` and `/api/metrics/*` on Vercel (multi-replica).

## Problème

Sans Upstash, `checkRateLimit()` utilise un compteur **en mémoire par instance**. Chaque replica Vercel a son propre seuil → un attaquant peut multiplier les requêtes par le nombre de replicas.

## Solution

1. Créer une base Redis sur [console.upstash.com](https://console.upstash.com) (région proche de `cdg1`, ex. `eu-west-1`)
2. Copier **UPSTASH_REDIS_REST_URL** et **UPSTASH_REDIS_REST_TOKEN**
3. Ajouter dans **Vercel → Project web → Environment Variables → Production** :
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - (optionnel) `RATE_LIMIT_API_MAX=60`, `RATE_LIMIT_WINDOW_SEC=60`
4. Redéployer le web

## Vérification locale

```bash
# Dans .env.ops.local
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

node scripts/verify-upstash-rate-limit.mjs
```

## Vérification production

```bash
curl https://www.fmagence.online/api/health
```

`UPSTASH_REDIS_REST_URL` ne doit plus apparaître dans `configuration.issues`.

Tester un endpoint rate-limité (auth requise) : les headers `X-RateLimit-*` doivent être présents.

## Comportement code

| Contexte | Comportement |
|----------|--------------|
| Upstash configuré | `INCR` + `EXPIRE` via REST API |
| Upstash configuré mais down | fail-open (requête autorisée, log erreur) |
| Upstash absent (dev) | mémoire locale |
| Upstash absent (prod) | mémoire + warning `/api/health` |

Fichier : `apps/web/lib/security/rate-limit.ts`
