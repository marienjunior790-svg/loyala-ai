# @loyala/core-ai — AI Platform

Architecture production-ready, provider-agnostic, multi-tenant SaaS.

## Architecture

```
core-ai/src/
├── services/
│   ├── ai-service.ts              orchestrateAI(), aiComplete(), getAIMetrics()
│   └── automation-service.ts      7 fonctions métier Loyala
├── orchestrator/orchestrate.ts    point d'entrée unique (Blueprint T6)
├── pipeline/
│   ├── promptManager.ts           prompts versionnés, tokens minimisés
│   ├── classificationPipeline.ts  intent + priorityScore (0–100)
│   ├── providerRouter.ts          GPT-4o → Claude Sonnet → mock
│   ├── retryHandler.ts            exponential backoff
│   └── responseValidator.ts       validation JSON Zod
├── campaign/campaignEngine.ts     anniversaires, fidélité, promos
├── rfm/
│   ├── scoring.ts                 RFM déterministe
│   └── rfmEngine.ts               LLM ciblé (vip / at_risk / dormant)
├── batch/processBatch.ts          concurrence limitée
├── cache/intelligentCache.ts        SHA-256 + TTL
├── guards/hallucinationGuard.ts   UUID, téléphone, faits inventés
├── observability/
│   ├── aiLogger.ts                sinks composites
│   ├── supabaseLogger.ts          → ai_request_logs
│   ├── supabaseMetrics.ts         RPC + fallback indexé
│   ├── tenantMetrics.ts           agrégation par tenant
│   └── bootstrap.ts               init providers + logs
└── types/prompt-variables.ts      variables typées par promptKey
```

## Provider routing

Ordre de résolution (`providerRouter.ts`) :

1. **OpenAI GPT-4o** — provider primaire (`AI_PRIMARY_PROVIDER=openai`)
2. **Claude Sonnet** — fallback (`AI_FALLBACK_PROVIDER=anthropic`)
3. **Mock** — dev/tests (`AI_ALLOW_MOCK=true`)

Chaque échec retryable déclenche le provider suivant. Toutes les requêtes sont loggées.

## Cache, retry, validation

| Couche | Rôle |
|--------|------|
| `intelligentCache` | Hash prompt + variables, TTL configurable |
| `retryHandler` | Backoff exponentiel, erreurs retryables uniquement |
| `responseValidator` | Parse JSON strict + schémas Zod par use case |
| `hallucinationGuard` | Bloque UUID/téléphones non présents dans le contexte |

## Cost optimization strategy

1. **RFM déterministe** avant tout appel LLM
2. **LLM uniquement** sur segments `vip`, `at_risk`, `dormant`
3. **Cache** SHA-256 + TTL (`AI_CACHE_TTL_SECONDS`)
4. **Prompts courts** + `maxTokens` par use case
5. **Batch** `processBatch({ concurrency })` pour campagnes
6. **Plafond coût** `AI_MAX_COST_USD` par requête
7. **Logs Supabase** → analytics sans re-scan complet (RPC indexée)

## Usage

### Bootstrap production

```typescript
import { bootstrapAI, SupabaseAILogger } from '@loyala/core-ai';
import { createAdminClient } from '@loyala/db';

const admin = createAdminClient(url, serviceRoleKey);
bootstrapAI({ supabaseAdmin: admin });
```

### orchestrateAI

```typescript
import { orchestrateAI, createAutomationService } from '@loyala/core-ai';

const response = await orchestrateAI({
  tenantId: organizationId,
  promptKey: 'inbox.message.classify',
  variables: { message: 'Bonjour', messageId: 'm1' },
});

const ai = createAutomationService(organizationId);
await ai.classifyMessage({ messageId: 'm1', text: 'Quels sont vos horaires ?' });
await ai.runBirthdayCampaigns(clients, 'Le Petit Dakar');
```

### Métriques tenant

```typescript
import { getAIMetrics, getTenantMetricsFromSupabase } from '@loyala/core-ai';

// Worker (après bootstrap Supabase)
const metrics = await getAIMetrics(tenantId);

// Web (client authentifié + RPC RLS)
const metrics = await getTenantMetricsFromSupabase(supabase, tenantId, 30);
// → requests, costUsd, avgLatencyMs, errorRate, fallbackRate, byProvider, byUseCase
```

## Worker & Inngest

| Route / Job | Description |
|-------------|-------------|
| `POST /ai/*` | 7 fonctions IA synchrones |
| `GET /ai/stats` | Métriques tenant |
| `GET /api/inngest` | Handler Inngest |
| Cron `0 8 * * *` | Dispatcher quotidien |
| `loyala/campaign.birthday.run` | Campagnes anniversaire par tenant |
| `loyala/campaign.inactive.run` | Relance inactifs par tenant |

## Variables d'environnement

Voir `.env.example` à la racine. **Ne jamais committer les clés API.**

| Variable | Requis prod |
|----------|-------------|
| `OPENAI_API_KEY` | Si primary=openai |
| `ANTHROPIC_API_KEY` | Si fallback=anthropic |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker (logs INSERT) |
| `INNGEST_EVENT_KEY` | Worker prod |
| `INNGEST_SIGNING_KEY` | Worker prod |
| `AI_ALLOW_MOCK` | `true` uniquement en dev |

Validation fail-fast : `@loyala/validation` → `parseWorkerEnv()`, `parseWebEnv()`.

## Migrations Supabase

```bash
DATABASE_URL=postgresql://... pnpm db:migrate
```

Fichiers : `003_ai_logs.sql`, `004_client_date_of_birth.sql`, `005_ai_metrics_rpc.sql`
