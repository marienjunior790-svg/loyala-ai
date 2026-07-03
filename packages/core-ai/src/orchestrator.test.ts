import { describe, it, expect, beforeEach } from 'vitest';
import { computeRFMScore } from '../src/rfm/scoring';
import { parseJSONResponse, JSONValidationError } from '../src/pipeline/responseValidator';
import { segmentSchema, messageClassifySchema } from '../src/schemas/outputs';
import { checkHallucinations } from '../src/guards/hallucinationGuard';
import { IntelligentCache } from '../src/cache/intelligentCache';
import { bootstrapProviders, getRegisteredProviders } from '../src/providers/registry';
import { orchestrate, clearAICache } from '../src/orchestrator/orchestrate';
import { setAILogger, InMemoryAILogger } from '../src/observability/aiLogger';
import { classifyMessage } from '../src/engines/classification';
import { segmentClient } from '../src/engines/segmentation';

describe('RFM scoring', () => {
  it('scores VIP client correctly', () => {
    const score = computeRFMScore({
      clientId: 'c1',
      recencyDays: 3,
      frequency: 15,
      monetary: 600_000,
    });
    expect(score.segment).toBe('vip');
    expect(score.totalScore).toBeGreaterThanOrEqual(12);
  });

  it('marks new client with zero frequency', () => {
    const score = computeRFMScore({
      clientId: 'c2',
      recencyDays: 1,
      frequency: 0,
      monetary: 0,
    });
    expect(score.segment).toBe('new');
  });
});

describe('JSON validator', () => {
  it('parses fenced JSON', () => {
    const raw = '```json\n{"segment":"regular","confidence":0.9,"action":"x","reason":"y"}\n```';
    const result = parseJSONResponse(raw, segmentSchema);
    expect(result.segment).toBe('regular');
  });

  it('rejects invalid schema', () => {
    expect(() => parseJSONResponse('{"segment":"invalid"}', segmentSchema)).toThrow(
      JSONValidationError
    );
  });
});

describe('Hallucination guard', () => {
  it('flags invented phone numbers', () => {
    const result = checkHallucinations({
      content: 'Appelez le +221771234567',
      allowedFacts: ['Aminata'],
    });
    expect(result.safe).toBe(false);
    expect(result.reasons).toContain('invented_phone_number');
  });
});

describe('Intelligent cache', () => {
  it('returns cached values within TTL', () => {
    const cache = new IntelligentCache<string>(60);
    cache.set({ k: 1 }, 'hello', 3600);
    expect(cache.get({ k: 1 })).toBe('hello');
  });
});

describe('Orchestrator (mock provider)', () => {
  const memoryLogger = new InMemoryAILogger();

  beforeEach(() => {
    clearAICache();
    bootstrapProviders();
    setAILogger(memoryLogger);
  });

  it('registers mock provider', () => {
    expect(getRegisteredProviders()).toContain('mock');
  });

  it('segments client via orchestrate', async () => {
    const result = await segmentClient('org-1', {
      clientId: 'c1',
      fullName: 'Aminata Diallo',
      recencyDays: 10,
      frequency: 8,
      monetary: 150_000,
    });
    expect(result.rfm.segment).toBeDefined();
    expect(result.ai.segment).toBe('regular');
    expect(result.ai.confidence).toBeGreaterThan(0);
  });

  it('classifies messages with priority score', async () => {
    const result = await classifyMessage('org-1', {
      messageId: 'm1',
      text: 'Quels sont vos horaires ?',
    });
    expect(result.intent).toBe('question');
    expect(result.messageId).toBe('m1');
    expect(result.priorityScore).toBeGreaterThan(0);
    expect(result.priorityScore).toBeLessThanOrEqual(100);
  });

  it('uses cache on repeated requests', async () => {
    const req = {
      organizationId: 'org-cache',
      useCase: 'client.segment' as const,
      input: { clientId: 'c-cache', fullName: 'Test', rfmSegment: 'regular' },
      jsonSchema: segmentSchema,
    };
    await orchestrate(req);
    const cached = await orchestrate(req);
    expect(cached.cached).toBe(true);
  });

  it('tracks token usage in logger', async () => {
    await orchestrate({
      organizationId: 'org-stats',
      useCase: 'inbox.message.classify',
      input: { message: 'Bonjour', messageId: 'm2' },
      jsonSchema: messageClassifySchema,
    });
    const stats = memoryLogger.getTokenStats('org-stats');
    expect(stats.requests).toBeGreaterThan(0);
    expect(stats.inputTokens).toBeGreaterThan(0);
  });
});
