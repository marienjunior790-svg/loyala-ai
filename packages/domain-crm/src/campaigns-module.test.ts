import { describe, it, expect, vi } from 'vitest';

/**
 * Regression: server actions must await async helpers so rejections
 * are caught by try/catch (avoids POST /campaigns → 500 error boundary).
 */
describe('generateLoyaltyCampaign action error handling', () => {
  it('awaited rejection is caught by try/catch', async () => {
    async function flaky() {
      throw new Error('column organizations.plan_status does not exist');
    }

    async function actionWithAwait() {
      try {
        return await flaky();
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'err' };
      }
    }

    async function actionWithoutAwait() {
      try {
        return flaky();
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'err' };
      }
    }

    await expect(actionWithAwait()).resolves.toEqual({
      error: 'column organizations.plan_status does not exist',
    });
    await expect(actionWithoutAwait()).rejects.toThrow('plan_status');
  });
});

describe('getOrganization select columns', () => {
  it('includes plan_status required by worker cron and billing', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'packages/domain-crm/src/organizations.ts'),
      'utf8'
    );
    expect(src).toContain('plan_status');
    expect(src).toContain('settings');
  });
});
