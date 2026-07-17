import type { z } from 'zod';

/** AI use cases / prompt keys — all flows route through orchestrate() */
export type AIUseCase =
  | 'client.segment'
  | 'client.inactive.analyze'
  | 'campaign.birthday.generate'
  | 'campaign.loyalty.generate'
  | 'campaign.affinity.generate'
  | 'campaign.promotion.suggest'
  | 'catalog.generate'
  | 'inbox.reply.generate'
  | 'inbox.message.classify'
  | 'inbox.reply.suggest'
  | 'campaign.message.generate'
  | 'review.response.suggest'
  | 'crm_summary'
  | 'rfm_analysis'
  | 'support_reply';

export type PromptKey = AIUseCase | string;

export type AIProviderId = 'openai' | 'anthropic' | 'mock';

/** Primary orchestrator input (tenant-scoped) */
export interface OrchestrateInput {
  tenantId: string;
  userId?: string;
  promptKey: PromptKey;
  variables: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: z.ZodType;
  skipCache?: boolean;
}

/** Legacy request shape — engines & worker */
export interface AIRequest {
  organizationId: string;
  useCase: AIUseCase;
  input: Record<string, unknown>;
  locale?: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: z.ZodType;
  skipCache?: boolean;
  actorId?: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AIResponse {
  requestId: string;
  content: string;
  parsed?: unknown;
  model: string;
  provider: AIProviderId;
  usage: AIUsage;
  cached: boolean;
  latencyMs: number;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
}

export interface AICompletionParams {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
}

export interface AIProviderResult {
  content: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  id: AIProviderId;
  complete(params: AICompletionParams): Promise<AIProviderResult>;
}

export interface AILogEntry {
  requestId: string;
  organizationId: string;
  useCase: string;
  provider: AIProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  cached: boolean;
  success: boolean;
  error?: string;
  createdAt: string;
  userId?: string;
}

export interface AILogSink {
  write(entry: AILogEntry): Promise<void>;
}

export interface OrchestratorConfig {
  primaryProvider: AIProviderId;
  fallbackProvider: AIProviderId;
  maxRetries: number;
  cacheTtlSeconds: number;
  maxCostUsdPerRequest: number;
}

export interface ProviderRouteContext {
  tenantId: string;
  userId?: string;
  maxRetries: number;
}

export interface ValidatedAIOutput {
  text: string;
  confidence: number;
  raw: string;
  parsed?: unknown;
}
