import { randomUUID } from 'node:crypto';
import { loadAIConfig } from '../config';
import { estimateCost } from '../models';
import { buildPrompt } from '../pipeline/promptManager';
import { routeProvider } from '../pipeline/providerRouter';
import { validateResponse } from '../pipeline/responseValidator';
import { hallucinationGuard } from '../guards/hallucinationGuard';
import { logAIRequest } from '../observability/aiLogger';
import {
  buildCacheKey,
  getCachedResponse,
  setCache,
  clearCache,
} from '../cache/intelligentCache';
import type { AIRequest, AIResponse, OrchestrateInput } from '../types';

function extractAllowedFacts(variables: Record<string, unknown>): string[] {
  const facts: string[] = [];
  const walk = (obj: unknown) => {
    if (typeof obj === 'string' || typeof obj === 'number') facts.push(String(obj));
    else if (Array.isArray(obj)) obj.forEach(walk);
    else if (obj && typeof obj === 'object') Object.values(obj).forEach(walk);
  };
  walk(variables);
  return facts;
}

function isLegacyRequest(input: OrchestrateInput | AIRequest): input is AIRequest {
  return 'useCase' in input && 'organizationId' in input;
}

function toOrchestrateInput(input: OrchestrateInput | AIRequest): OrchestrateInput {
  if (!isLegacyRequest(input)) return input;
  return {
    tenantId: input.organizationId,
    userId: input.actorId,
    promptKey: input.useCase,
    variables: input.input,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    jsonSchema: input.jsonSchema,
    skipCache: input.skipCache,
    images: input.images,
    skipGuard: input.skipGuard,
  };
}

/**
 * Single entry point — Blueprint T6.
 * Accepts tenant-scoped input or legacy AIRequest.
 */
export async function orchestrate(input: OrchestrateInput | AIRequest): Promise<AIResponse> {
  const config = loadAIConfig();
  const normalized = toOrchestrateInput(input);
  const requestId = randomUUID();
  const start = Date.now();

  const cacheKey = buildCacheKey(
    normalized.tenantId,
    normalized.promptKey,
    normalized.variables
  );

  if (!normalized.skipCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) return { ...cached, requestId, cached: true };
  }

  const prompt = buildPrompt(normalized.promptKey, normalized.variables);
  if (normalized.maxTokens) prompt.maxTokens = normalized.maxTokens;
  if (normalized.temperature !== undefined) prompt.temperature = normalized.temperature;
  if (normalized.jsonSchema) prompt.jsonMode = true;
  if (normalized.images && normalized.images.length > 0) prompt.images = normalized.images;

  const allowedFacts = extractAllowedFacts(normalized.variables);

  try {
    const routed = await routeProvider(prompt, {
      tenantId: normalized.tenantId,
      userId: normalized.userId,
      maxRetries: config.maxRetries,
    });

    const validated = validateResponse(routed, normalized.jsonSchema);
    const safe = normalized.skipGuard
      ? validated
      : hallucinationGuard(validated, allowedFacts);

    const costUsd = estimateCost(
      routed.model,
      routed.usage.inputTokens,
      routed.usage.outputTokens
    );

    const latencyMs = Date.now() - start;
    const response: AIResponse = {
      requestId,
      content: safe.raw,
      parsed: safe.parsed,
      model: routed.model,
      provider: routed.provider,
      usage: {
        inputTokens: routed.usage.inputTokens,
        outputTokens: routed.usage.outputTokens,
        costUsd,
      },
      cached: false,
      latencyMs,
    };

    if (!normalized.skipCache) {
      setCache(cacheKey, response, config.cacheTtlSeconds * 1000);
    }

    await logAIRequest({
      requestId,
      organizationId: normalized.tenantId,
      userId: normalized.userId,
      useCase: normalized.promptKey,
      provider: routed.provider,
      model: routed.model,
      inputTokens: routed.usage.inputTokens,
      outputTokens: routed.usage.outputTokens,
      costUsd,
      latencyMs,
      cached: false,
      success: true,
      createdAt: new Date().toISOString(),
    });

    return response;
  } catch (error) {
    await logAIRequest({
      requestId,
      organizationId: normalized.tenantId,
      userId: normalized.userId,
      useCase: normalized.promptKey,
      provider: 'mock',
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      cached: false,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      createdAt: new Date().toISOString(),
    });
    throw error;
  }
}

export function clearAICache(): void {
  clearCache();
}
