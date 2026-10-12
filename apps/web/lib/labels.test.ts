import { describe, expect, it } from 'vitest';
import {
  campaignStatusLabel,
  planLabel,
  planStatusLabel,
  roleLabel,
  segmentLabel,
} from './labels';

describe('labels', () => {
  it('translates known codes', () => {
    expect(segmentLabel('at_risk')).toBe('À risque');
    expect(roleLabel('org_owner')).toBe('Propriétaire');
    expect(planLabel('growth')).toBe('Pro');
    expect(planLabel('pro')).toBe('Pro+');
    expect(planStatusLabel('trialing')).toBe('Actif');
    expect(campaignStatusLabel('scheduled')).toBe('Programmée');
  });

  it('falls back to the raw code or a dash', () => {
    expect(segmentLabel('custom_segment')).toBe('custom_segment');
    expect(roleLabel(null)).toBe('—');
  });
});
