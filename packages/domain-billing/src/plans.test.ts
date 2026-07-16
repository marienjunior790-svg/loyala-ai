import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  getPlan,
  isPaidPlan,
  normalizePlanCode,
  formatFcfa,
} from './plans';

describe('billing plans catalogue', () => {
  it('exposes trial/growth/pro', () => {
    expect(BILLING_PLANS.map((p) => p.code)).toEqual(['trial', 'growth', 'pro']);
  });

  it('maps legacy codes', () => {
    expect(normalizePlanCode('starter')).toBe('growth');
    expect(normalizePlanCode('enterprise')).toBe('pro');
    expect(normalizePlanCode('trial')).toBe('trial');
  });

  it('marks paid plans', () => {
    expect(isPaidPlan('trial')).toBe(false);
    expect(isPaidPlan('growth')).toBe(true);
    expect(getPlan('growth')?.amountXaf).toBe(19900);
  });

  it('formats FCFA', () => {
    expect(formatFcfa(19900)).toContain('FCFA');
  });
});
