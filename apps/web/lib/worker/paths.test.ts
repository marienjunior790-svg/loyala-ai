import { describe, expect, it } from 'vitest';
import { isAllowedAiPath, toWorkerAiPath } from './paths';

describe('worker paths', () => {
  it('allows known AI sub-paths', () => {
    expect(isAllowedAiPath('stats')).toBe(true);
    expect(isAllowedAiPath('inactive/detect')).toBe(true);
    expect(isAllowedAiPath('campaigns/birthday')).toBe(true);
    expect(isAllowedAiPath('campaigns/affinity')).toBe(true);
    expect(isAllowedAiPath('catalog/generate')).toBe(true);
    expect(isAllowedAiPath('catalog/import')).toBe(true);
  });

  it('rejects unknown paths', () => {
    expect(isAllowedAiPath('admin/delete')).toBe(false);
    expect(isAllowedAiPath('../health')).toBe(false);
  });

  it('builds worker AI path', () => {
    expect(toWorkerAiPath('segment')).toBe('/ai/segment');
  });
});
