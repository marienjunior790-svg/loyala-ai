import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProviderMetrics {
  requests: number;
  costUsd: number;
}

export interface AIMetricsSummary {
  tenantId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  successRate: number;
  errorRate: number;
  fallbackRate: number;
  byProvider: Record<string, ProviderMetrics>;
  byUseCase: Record<string, ProviderMetrics>;
  since?: string;
}

function sinceIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function emptyMetrics(tenantId: string, since: string): AIMetricsSummary {
  return {
    tenantId,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    avgLatencyMs: 0,
    cacheHitRate: 0,
    successRate: 1,
    errorRate: 0,
    fallbackRate: 0,
    byProvider: {},
    byUseCase: {},
    since,
  };
}

/** Dashboard metrics — uses indexed RPC get_tenant_ai_metrics (same as getAIMetrics). */
export async function fetchAIMetricsForTenant(
  supabase: SupabaseClient,
  organizationId: string,
  sinceDays = 30
): Promise<AIMetricsSummary> {
  const since = sinceIso(sinceDays);
  const { data, error } = await supabase.rpc('get_tenant_ai_metrics', {
    p_organization_id: organizationId,
    p_since: since,
  });

  if (error) {
    throw new Error(`get_tenant_ai_metrics: ${error.message}`);
  }

  if (!data || typeof data !== 'object') {
    return emptyMetrics(organizationId, since);
  }

  const raw = data as Record<string, unknown>;
  return {
    tenantId: organizationId,
    requests: Number(raw.requests ?? 0),
    inputTokens: Number(raw.inputTokens ?? 0),
    outputTokens: Number(raw.outputTokens ?? 0),
    totalTokens: Number(raw.totalTokens ?? 0),
    costUsd: Number(raw.costUsd ?? 0),
    avgLatencyMs: Number(raw.avgLatencyMs ?? 0),
    cacheHitRate: Number(raw.cacheHitRate ?? 0),
    successRate: Number(raw.successRate ?? 1),
    errorRate: Number(raw.errorRate ?? 0),
    fallbackRate: Number(raw.fallbackRate ?? 0),
    byProvider: (raw.byProvider ?? {}) as Record<string, ProviderMetrics>,
    byUseCase: (raw.byUseCase ?? {}) as Record<string, ProviderMetrics>,
    since: String(raw.since ?? since),
  };
}

/** Format metrics for dashboard KPI cards (data layer only). */
export function formatAIMetricsKpis(metrics: AIMetricsSummary) {
  const openai = metrics.byProvider.openai?.requests ?? 0;
  const anthropic = metrics.byProvider.anthropic?.requests ?? 0;
  const gptShare = metrics.requests ? Math.round((openai / metrics.requests) * 100) : 0;
  const claudeShare = metrics.requests ? Math.round((anthropic / metrics.requests) * 100) : 0;

  return {
    aiRequests: metrics.requests,
    aiCostUsd: metrics.costUsd,
    aiAvgLatencyMs: metrics.avgLatencyMs,
    aiErrorRate: metrics.errorRate,
    aiFallbackRate: metrics.fallbackRate,
    aiCacheHitRate: metrics.cacheHitRate,
    aiProviderSplit: { openai: gptShare, anthropic: claudeShare },
    aiTotalTokens: metrics.totalTokens,
  };
}
