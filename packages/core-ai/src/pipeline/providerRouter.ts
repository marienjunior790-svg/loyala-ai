import { loadAIConfig } from '../config';
import { estimateCost } from '../models';
import { withRetry, isRetryable } from './retryHandler';
import { resolveProviderChain, getProvider } from '../providers/registry';
import type {
  AIProviderId,
  AIProviderResult,
  BuiltPrompt,
  ProviderRouteContext,
} from '../types';

export interface RoutedResult extends AIProviderResult {
  provider: AIProviderId;
}

export async function routeProvider(
  prompt: BuiltPrompt,
  ctx: ProviderRouteContext
): Promise<RoutedResult> {
  const config = loadAIConfig();
  const chain = resolveProviderChain();

  if (chain.length === 0) {
    throw new Error('[core-ai] No providers registered. Call bootstrapProviders() first.');
  }

  let lastError: unknown;

  for (const providerId of chain) {
    const provider = getProvider(providerId);
    if (!provider) continue;

    try {
      const result = await withRetry(
        () =>
          provider.complete({
            system: prompt.system,
            user: prompt.user,
            maxTokens: prompt.maxTokens,
            temperature: prompt.temperature,
            jsonMode: prompt.jsonMode,
            images: prompt.images,
          }),
        { maxAttempts: ctx.maxRetries }
      );

      const costUsd = estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );

      if (costUsd > config.maxCostUsdPerRequest) {
        throw new Error(
          `[core-ai] Cost $${costUsd.toFixed(4)} exceeds limit $${config.maxCostUsdPerRequest}`
        );
      }

      return { ...result, provider: provider.id };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) && providerId !== chain[chain.length - 1]) {
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('[core-ai] All providers failed');
}
