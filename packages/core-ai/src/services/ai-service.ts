import { orchestrate, clearAICache } from '../orchestrator/orchestrate';
import { bootstrapAI } from '../observability/bootstrap';
import { getTenantMetrics } from '../observability/tenantMetrics';
import { getAILogger, setAILogger, InMemoryAILogger } from '../observability/aiLogger';
import { bootstrapProviders } from '../providers/registry';
import { buildPrompt } from '../pipeline/promptManager';
import { toPromptRecord, type TypedPromptVariables } from '../types/prompt-variables';
import type { AIRequest, AIResponse, OrchestrateInput, PromptKey } from '../types/index';

/**
 * AI Service Layer — single public entry for all Loyala AI calls.
 * Blueprint T6: no direct provider access outside this module.
 */

export function initAIService(): void {
  bootstrapAI({ enableConsole: true });
}

export interface TypedOrchestrateInput<K extends keyof import('../types/prompt-variables').PromptVariablesMap> {
  tenantId: string;
  userId?: string;
  promptKey: K;
  variables: TypedPromptVariables<K>;
  jsonSchema?: OrchestrateInput['jsonSchema'];
  skipCache?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/** Primary API — tenant-scoped orchestration */
export async function orchestrateAI(input: OrchestrateInput | AIRequest): Promise<AIResponse> {
  initAIService();
  return orchestrate(input);
}

/** Typed prompt variables wrapper */
export async function orchestrateAITyped<
  K extends keyof import('../types/prompt-variables').PromptVariablesMap,
>(input: TypedOrchestrateInput<K>): Promise<AIResponse> {
  return orchestrateAI({
    tenantId: input.tenantId,
    userId: input.userId,
    promptKey: input.promptKey,
    variables: toPromptRecord(input.variables),
    jsonSchema: input.jsonSchema,
    skipCache: input.skipCache,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });
}

/** Legacy alias — engines & worker */
export async function aiComplete(request: AIRequest): Promise<AIResponse> {
  return orchestrateAI(request);
}

export function getAITokenStats(organizationId?: string) {
  const logger = getAILogger();
  if (logger instanceof InMemoryAILogger) {
    return logger.getTokenStats(organizationId);
  }
  return null;
}

export function getAIMetrics(tenantId: string, sinceDays = 30) {
  return getTenantMetrics(tenantId, sinceDays);
}

export {
  orchestrate,
  clearAICache,
  setAILogger,
  bootstrapProviders,
  bootstrapAI,
  buildPrompt,
  toPromptRecord,
};

export type { AIRequest, AIResponse, OrchestrateInput, PromptKey };
