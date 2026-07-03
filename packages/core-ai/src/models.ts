import type { AIProviderId } from './types/index';

export interface ModelSpec {
  id: string;
  provider: AIProviderId;
  inputCostPer1M: number;
  outputCostPer1M: number;
  maxOutputTokens: number;
}

/** Model registry — Blueprint cost controller */
export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
    maxOutputTokens: 4096,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    maxOutputTokens: 4096,
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    maxOutputTokens: 4096,
  },
};

export function getModelForProvider(provider: AIProviderId, preferMini = false): ModelSpec {
  if (provider === 'openai') {
    return preferMini ? MODEL_REGISTRY['gpt-4o-mini']! : MODEL_REGISTRY['gpt-4o']!;
  }
  if (provider === 'anthropic') {
    return MODEL_REGISTRY['claude-sonnet-4-20250514']!;
  }
  return MODEL_REGISTRY['gpt-4o-mini']!;
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const spec = MODEL_REGISTRY[modelId];
  if (!spec) return 0;
  return (
    (inputTokens / 1_000_000) * spec.inputCostPer1M +
    (outputTokens / 1_000_000) * spec.outputCostPer1M
  );
}
