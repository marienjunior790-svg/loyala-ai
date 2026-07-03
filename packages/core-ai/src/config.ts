import type { AIProviderId, OrchestratorConfig } from './types/index';

export function loadAIConfig(): OrchestratorConfig & {
  openaiApiKey?: string;
  anthropicApiKey?: string;
} {
  return {
    primaryProvider: (process.env.AI_PRIMARY_PROVIDER as AIProviderId) ?? 'openai',
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER as AIProviderId) ?? 'anthropic',
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? 3),
    cacheTtlSeconds: Number(process.env.AI_CACHE_TTL_SECONDS ?? 3600),
    maxCostUsdPerRequest: Number(process.env.AI_MAX_COST_USD ?? 0.05),
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}
