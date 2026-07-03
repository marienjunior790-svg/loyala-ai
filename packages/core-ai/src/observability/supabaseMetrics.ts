import type { TenantAIMetrics } from './tenantMetrics';

export interface SupabaseMetricsClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface SupabaseMetricsRowClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        gte(column: string, value: string): PromiseLike<{
          data: Array<Record<string, unknown>> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

const DEFAULT_SINCE_DAYS = 30;

function sinceIso(days = DEFAULT_SINCE_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function emptyMetrics(tenantId: string, since: string): TenantAIMetrics {
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

function parseRpcMetrics(tenantId: string, raw: Record<string, unknown>): TenantAIMetrics {
  const byProvider = (raw.byProvider ?? {}) as TenantAIMetrics['byProvider'];
  const byUseCase = (raw.byUseCase ?? {}) as TenantAIMetrics['byUseCase'];

  return {
    tenantId,
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
    byProvider,
    byUseCase,
    since: String(raw.since ?? sinceIso()),
  };
}

/** Fetch tenant AI metrics via indexed RPC (preferred). */
export async function fetchTenantAIMetricsFromSupabase(
  client: SupabaseMetricsClient,
  tenantId: string,
  sinceDays = DEFAULT_SINCE_DAYS
): Promise<TenantAIMetrics> {
  const since = sinceIso(sinceDays);
  const { data, error } = await client.rpc('get_tenant_ai_metrics', {
    p_organization_id: tenantId,
    p_since: since,
  });

  if (error) {
    throw new Error(`get_tenant_ai_metrics failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object') {
    return emptyMetrics(tenantId, since);
  }

  return parseRpcMetrics(tenantId, data as Record<string, unknown>);
}

/** Fallback: aggregate rows client-side (uses org+created_at index). */
export async function aggregateTenantAIMetricsFromRows(
  client: SupabaseMetricsRowClient,
  tenantId: string,
  sinceDays = DEFAULT_SINCE_DAYS
): Promise<TenantAIMetrics> {
  const since = sinceIso(sinceDays);
  const { data, error } = await client
    .from('ai_request_logs')
    .select(
      'use_case, provider, input_tokens, output_tokens, cost_usd, latency_ms, cached, success'
    )
    .eq('organization_id', tenantId)
    .gte('created_at', since);

  if (error) {
    throw new Error(`ai_request_logs query failed: ${error.message}`);
  }

  if (!data?.length) return emptyMetrics(tenantId, since);

  const byUseCase: TenantAIMetrics['byUseCase'] = {};
  const byProvider: TenantAIMetrics['byProvider'] = {};
  let cached = 0;
  let successes = 0;
  let latencySum = 0;
  let fallbackCount = 0;

  for (const row of data) {
    const useCase = String(row.use_case);
    const provider = String(row.provider);
    const cost = Number(row.cost_usd ?? 0);

    if (!byUseCase[useCase]) byUseCase[useCase] = { requests: 0, costUsd: 0 };
    byUseCase[useCase]!.requests += 1;
    byUseCase[useCase]!.costUsd += cost;

    if (!byProvider[provider]) byProvider[provider] = { requests: 0, costUsd: 0 };
    byProvider[provider]!.requests += 1;
    byProvider[provider]!.costUsd += cost;

    if (row.cached) cached += 1;
    if (row.success) successes += 1;
    latencySum += Number(row.latency_ms ?? 0);
    if (provider === 'anthropic') fallbackCount += 1;
  }

  const requests = data.length;
  const inputTokens = data.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0);
  const outputTokens = data.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0);

  return {
    tenantId,
    requests,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    avgLatencyMs: requests ? Math.round(latencySum / requests) : 0,
    cacheHitRate: requests ? cached / requests : 0,
    successRate: requests ? successes / requests : 1,
    errorRate: requests ? (requests - successes) / requests : 0,
    fallbackRate: requests ? fallbackCount / requests : 0,
    byProvider,
    byUseCase,
    since,
  };
}
