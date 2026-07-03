// ─── Orchestrator ───────────────────────────────────────────
export { orchestrate, clearAICache } from './orchestrator/orchestrate';

// ─── AI Service Layer ───────────────────────────────────────
export {
  initAIService,
  orchestrateAI,
  orchestrateAITyped,
  aiComplete,
  getAITokenStats,
  getAIMetrics,
  buildPrompt,
  toPromptRecord,
  bootstrapAI,
} from './services/ai-service';
export { AutomationService, createAutomationService } from './services/automation-service';

// ─── Pipeline ───────────────────────────────────────────────
export { promptManager, PromptManager } from './pipeline/promptManager';
export {
  ClassificationPipeline,
  createClassificationPipeline,
  computePriorityScore,
} from './pipeline/classificationPipeline';
export { routeProvider } from './pipeline/providerRouter';
export { retry, withRetry, isRetryable } from './pipeline/retryHandler';
export { validateResponse, parseJSONResponse, JSONValidationError } from './pipeline/responseValidator';

// ─── Campaign Engine ────────────────────────────────────────
export {
  CampaignEngine,
  CampaignOrchestrator,
  createCampaignOrchestrator,
} from './campaign/campaignEngine';

// ─── RFM Engine ─────────────────────────────────────────────
export { RFMEngine, createRFMEngine, computeRFMScore, computeRFMBatch } from './rfm/rfmEngine';

// ─── Cache / Guards / Batch ─────────────────────────────────
export {
  buildCacheKey,
  getCachedResponse,
  setCache,
  clearCache,
  IntelligentCache,
} from './cache/intelligentCache';
export {
  hallucinationGuard,
  checkHallucinations,
  assertSafeResponse,
} from './guards/hallucinationGuard';
export { processBatch, processBatchSafe } from './batch/processBatch';

// ─── Observability ────────────────────────────────────────────
export {
  logAIRequest,
  getAILogger,
  setAILogger,
  InMemoryAILogger,
  ConsoleAILogger,
  CompositeAILogger,
} from './observability/aiLogger';
export { SupabaseAILogger } from './observability/supabaseLogger';
export { getTenantMetrics, aggregateTenantMetrics, setSupabaseMetricsReader } from './observability/tenantMetrics';
export {
  fetchTenantAIMetricsFromSupabase,
  aggregateTenantAIMetricsFromRows,
} from './observability/supabaseMetrics';
export { getTenantMetricsFromSupabase } from './observability/tenantMetrics';
export { bootstrapAI as bootstrapAIObservability, getMemoryLogger } from './observability/bootstrap';

// ─── Providers ────────────────────────────────────────────────
export {
  bootstrapProviders,
  registerProvider,
  getProvider,
  getRegisteredProviders,
  resolveProviderChain,
} from './providers/registry';

// ─── Engines (legacy re-exports) ────────────────────────────
export { classifyMessage, classifyMessagesBatch } from './engines/classification';
export { generateAutoReply } from './engines/auto-reply';
export { detectInactiveClients, analyzeInactiveClient } from './engines/inactive-detection';
export { segmentClient, segmentClientsBatch } from './engines/segmentation';

// ─── Config / Models / Schemas ──────────────────────────────
export { loadAIConfig } from './config';
export { MODEL_REGISTRY, estimateCost, getModelForProvider } from './models';
export * from './schemas/outputs';

export type {
  AIProvider,
  AIRequest,
  AIResponse,
  AIUseCase,
  AIProviderId,
  AIUsage,
  AILogEntry,
  AILogSink,
  OrchestratorConfig,
  OrchestrateInput,
  PromptKey,
  BuiltPrompt,
  ValidatedAIOutput,
} from './types/index';

export type {
  SegmentVariables,
  ClassifyVariables,
  BirthdayVariables,
  TypedPromptVariables,
  PromptVariablesMap,
} from './types/prompt-variables';

export type { ClientRFMInput, RFMScore } from './rfm/scoring';
export type { InactiveClient } from './engines/inactive-detection';
export type {
  ClassificationInput,
  ClassificationResult,
} from './pipeline/classificationPipeline';
export type { TenantAIMetrics } from './observability/tenantMetrics';
export type { BirthdayClient, LoyaltyClient, CampaignPlan } from './engines/campaign-engine';
