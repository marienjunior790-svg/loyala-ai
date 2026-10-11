import { describe, expect, it } from 'vitest';
import { campaignStatusLabel, planStatusLabel, roleLabel, segmentLabel } from './labels';

describe('labels', () => {
  it('translates known codes', () => {
    expect(segmentLabel('at_risk')).toBe('À risque');
    expect(roleLabel('org_owner')).toBe('Propriétaire');
    expect(planStatusLabel('trialing')).toBe('Essai en cours');
    expect(campaignStatusLabel('scheduled')).toBe('Programmée');
  });

  it('falls back to the raw code or a dash', () => {
    expect(segmentLabel('custom_segment')).toBe('custom_segment');
    expect(roleLabel(null)).toBe('—');
  });
});
