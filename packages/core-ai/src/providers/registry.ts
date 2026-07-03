import { loadAIConfig } from '../config';
import { createOpenAIProvider } from './openai';
import { createAnthropicProvider } from './anthropic';
import { createMockProvider } from './mock';
import type { AIProvider } from '../types/index';

const providers = new Map<string, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): AIProvider | undefined {
  return providers.get(id);
}

export function getRegisteredProviders(): string[] {
  return [...providers.keys()];
}

/** Register providers from environment — call once at app bootstrap */
export function bootstrapProviders(): void {
  const config = loadAIConfig();

  registerProvider(createMockProvider());

  if (config.openaiApiKey) {
    registerProvider(createOpenAIProvider(config.openaiApiKey));
  }

  if (config.anthropicApiKey) {
    registerProvider(createAnthropicProvider(config.anthropicApiKey));
  }
}

export function resolveProviderChain(): string[] {
  const config = loadAIConfig();
  const chain = [config.primaryProvider, config.fallbackProvider, 'mock'];
  return [...new Set(chain)].filter((id) => providers.has(id));
}
