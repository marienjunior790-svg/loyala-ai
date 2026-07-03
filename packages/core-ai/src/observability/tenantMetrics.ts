import type { AILogEntry } from '../types/index';
import { getAILogger, InMemoryAILogger } from './aiLogger';
import {
  fetchTenantAIMetricsFromSupabase,
  aggregateTenantAIMetricsFromRows,
  type SupabaseMetricsClient,
  type SupabaseMetricsRowClient,
} from './supabaseMetrics';

export interface ProviderMetrics {
  requests: number;
  costUsd: number;
}

export interface TenantAIMetrics {
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
  byUseCase: Record<string, { requests: number; costUsd: number }>;
  since?: string;
}

let metricsReader: SupabaseMetricsClient | null = null;

export function setSupabaseMetricsReader(client: SupabaseMetricsClient): void {
  metricsReader = client;
}

export function aggregateTenantMetrics(
  entries: AILogEntry[],
  tenantId: string
): TenantAIMetrics {
  const filtered = entries.filter((e) => e.organizationId === tenantId);

  const byUseCase: TenantAIMetrics['byUseCase'] = {};
  const byProvider: TenantAIMetrics['byProvider'] = {};
  let cached = 0;
  let successes = 0;
  let latencySum = 0;
  let fallbackCount = 0;

  for (const e of filtered) {
    if (!byUseCase[e.useCase]) {
      byUseCase[e.useCase] = { requests: 0, costUsd: 0 };
    }
    byUseCase[e.useCase]!.requests += 1;
    byUseCase[e.useCase]!.costUsd += e.costUsd;

    if (!byProvider[e.provider]) {
      byProvider[e.provider] = { requests: 0, costUsd: 0 };
    }
    byProvider[e.provider]!.requests += 1;
    byProvider[e.provider]!.costUsd += e.costUsd;

    if (e.cached) cached += 1;
    if (e.success) successes += 1;
    latencySum += e.latencyMs;
    if (e.provider === 'anthropic') fallbackCount += 1;
  }

  const inputTokens = filtered.reduce((s, e) => s + e.inputTokens, 0);
  const outputTokens = filtered.reduce((s, e) => s + e.outputTokens, 0);
  const requests = filtered.length;

  return {
    tenantId,
    requests,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: filtered.reduce((s, e) => s + e.costUsd, 0),
    avgLatencyMs: requests ? Math.round(latencySum / requests) : 0,
    cacheHitRate: requests ? cached / requests : 0,
    successRate: requests ? successes / requests : 1,
    errorRate: requests ? (requests - successes) / requests : 0,
    fallbackRate: requests ? fallbackCount / requests : 0,
    byProvider,
    byUseCase,
  };
}

export async function getTenantMetrics(
  tenantId: string,
  sinceDays = 30
): Promise<TenantAIMetrics | null> {
  if (metricsReader) {
    try {
      return await fetchTenantAIMetricsFromSupabase(metricsReader, tenantId, sinceDays);
    } catch (error) {
      console.error('[core-ai] Supabase metrics RPC failed:', error);
    }
  }

  const logger = getAILogger();
  if (logger instanceof InMemoryAILogger) {
    return aggregateTenantMetrics(logger.entries, tenantId);
  }

  return null;
}

export async function getTenantMetricsFromSupabase(
  client: SupabaseMetricsClient & SupabaseMetricsRowClient,
  tenantId: string,
  sinceDays = 30
): Promise<TenantAIMetrics> {
  try {
    return await fetchTenantAIMetricsFromSupabase(client, tenantId, sinceDays);
  } catch {
    return aggregateTenantAIMetricsFromRows(client, tenantId, sinceDays);
  }
}
