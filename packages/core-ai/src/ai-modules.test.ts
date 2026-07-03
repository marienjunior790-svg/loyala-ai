import { describe, it, expect } from 'vitest';
import { computePriorityScore } from '../src/pipeline/classificationPipeline';
import { createRFMEngine } from '../src/rfm/rfmEngine';
import { processBatch } from '../src/batch/processBatch';
import { aggregateTenantMetrics } from '../src/observability/tenantMetrics';

describe('Classification priority scoring', () => {
  it('scores complaints higher than questions', () => {
    const complaint = computePriorityScore({
      intent: 'complaint',
      sentiment: 'negative',
      priority: 'high',
      summary: 'test',
    });
    const question = computePriorityScore({
      intent: 'question',
      sentiment: 'neutral',
      priority: 'medium',
      summary: 'test',
    });
    expect(complaint).toBeGreaterThan(question);
  });
});

describe('RFM Engine', () => {
  it('skips LLM for regular segments', async () => {
    const engine = createRFMEngine('tenant-1');
    const results = await engine.enrichWithAI([
      {
        clientId: 'c1',
        fullName: 'Regular Client',
        recencyDays: 20,
        frequency: 3,
        monetary: 80_000,
      },
    ]);
    expect(results[0]?.rfm.segment).toBe('regular');
    expect(results[0]?.ai.confidence).toBe(1);
  });
});

describe('processBatch', () => {
  it('processes items with concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processBatch(items, async (n) => n * 2, { concurrency: 2 });
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('Tenant metrics', () => {
  it('aggregates per use case', () => {
    const metrics = aggregateTenantMetrics(
      [
        {
          requestId: '1',
          organizationId: 'org-1',
          useCase: 'client.segment',
          provider: 'mock',
          model: 'mock',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: 0.001,
          latencyMs: 200,
          cached: false,
          success: true,
          createdAt: new Date().toISOString(),
        },
      ],
      'org-1'
    );
    expect(metrics.requests).toBe(1);
    expect(metrics.byUseCase['client.segment']?.requests).toBe(1);
  });
});
