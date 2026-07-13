# ADR-009: AI Automation Engine

**Statut:** Accepté — Sprint 2/3  
**Date:** 2026-06-24

## Contexte

Loyala AI est un SaaS multi-tenant pour la fidélité et la relation client (restaurants, horeca). Le produit doit automatiser :

- Segmentation clients (RFM + enrichissement IA ciblé)
- Détection et relance des clients inactifs
- Campagnes anniversaires personnalisées
- Classification et réponses inbox
- Suggestions promotionnelles

Ces flux impliquent des appels LLM coûteux, une isolation stricte par organisation, et une observabilité fine (tokens, coûts, latence, erreurs).

## Pourquoi ce système AI a été créé

1. **Coûts API** — Sans orchestration, chaque feature appellerait OpenAI directement → explosion des tokens et absence de cache.
2. **Multi-tenant** — Les données et logs IA doivent être scopés par `organization_id` avec RLS.
3. **Résilience** — Fallback provider, retry, validation JSON, garde-fous hallucinations.
4. **Automatisation** — Jobs cron (anniversaires, inactifs) ne doivent pas bloquer le web Next.js.
5. **Gouvernance Blueprint T6** — Un seul point d'entrée IA (`orchestrate()` / `orchestrateAI()`).

## Décision

### Architecture retenue

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Next.js    │────▶│  Worker      │────▶│  @loyala/core-ai │
│  (web)      │     │  HTTP+Inngest│     │  orchestrateAI() │
└─────────────┘     └──────────────┘     └────────┬────────┘
       │                    │                      │
       │                    │                      ▼
       │                    │            ┌─────────────────┐
       └────────────────────┴───────────▶│  ai_request_logs │
                                         │  (Supabase RLS)  │
                                         └─────────────────┘
```

#### AI Service Layer

- `orchestrateAI()` / `aiComplete()` — API publique unique
- `AutomationService` — 7 fonctions métier
- Aucun appel provider direct hors `packages/core-ai`

#### Provider-agnostic routing

| Ordre | Provider | Rôle |
|-------|----------|------|
| 1 | GPT-4o (OpenAI) | Primaire |
| 2 | Claude Sonnet (Anthropic) | Fallback |
| 3 | Mock | Dev / tests |

#### Event-driven automation (Inngest)

- **Cron quotidien 08:00** — dispatcher multi-tenant
- **`loyala/campaign.birthday.run`** — campagnes anniversaire par org
- **`loyala/campaign.inactive.run`** — relance fidélité par org
- Retry Inngest (3x), concurrency limitée, isolation `organizationId` par event

#### Multi-tenant strict

- Toutes les requêtes IA portent `tenantId` / `organizationId`
- Logs INSERT via service role (worker)
- Logs SELECT via RLS `auth.user_org_ids()`
- RPC `get_tenant_ai_metrics` avec contrôle d'accès org

#### Observabilité

- Table `ai_request_logs` (migration 003)
- `SupabaseAILogger` + `InMemoryAILogger` (dev)
- Métriques : requêtes, tokens, coût USD, latence, cache hit, erreurs, fallback rate, split GPT/Claude

#### Optimisation coûts

- RFM déterministe avant LLM (~60 % d'appels évités sur segments réguliers)
- Cache SHA-256 + TTL
- Prompts versionnés courts
- Batch processing campagnes

## Alternatives rejetées

### LangChain

**Rejeté** — Trop lourd pour notre surface (7 use cases), dépendances nombreuses, courbe d'apprentissage, coût bundle worker. Notre orchestrateur maison couvre routing, cache, retry, Zod, logs en ~2k LOC ciblées.

### Monolithe AI centralisé (tout dans Next.js)

**Rejeté** — Violation Blueprint T6/T5 (service role côté web), timeouts Vercel sur batch campagnes, pas de cron fiable sans infrastructure async.

### Appels LLM directs par feature

**Rejeté** — Pas de cache partagé, pas de fallback uniforme, pas de tracking coûts, risque hallucinations non contrôlé.

## Conséquences

### Positives

- **Scalabilité** — Worker horizontal + Inngest fan-out par tenant
- **Coûts API optimisés** — Cache, RFM, LLM ciblé, plafond par requête
- **Observabilité** — Dashboard via `GET /api/metrics/ai` + RPC indexée
- **Testabilité** — Mock provider, tests Vitest sur pipeline

### Négatives / compromis

- **Complexité modérée** — Package `core-ai` + worker + Inngest à maintenir
- **Ops** — Migrations Supabase, clés Inngest, monitoring logs à surveiller
- **CRM incomplet** — `date_of_birth` ajouté (migration 004) pour anniversaires ; envoi WhatsApp = voir ADR-010 (Message Router)

## Implémentation

| Composant | Chemin |
|-----------|--------|
| Core AI | `packages/core-ai/` |
| Worker routes | `apps/worker/src/ai-routes.ts` |
| Inngest | `apps/worker/src/inngest/` |
| Migrations | `supabase/migrations/003–005` |
| Métriques web | `apps/web/app/api/metrics/ai/route.ts` |
| Env validation | `packages/validation/src/env.ts` |

## Références

- ADR-005 Inngest Event Bus
- ADR-010 Message Router + Channel Adapter (envoi multi-canal)
- Blueprint v2.1 §5 (logging IA), T6 (orchestrateur unique)
