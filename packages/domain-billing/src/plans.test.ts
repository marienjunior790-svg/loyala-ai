import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  PUBLIC_BILLING_PLANS,
  getPlan,
  isPaidPlan,
  normalizePlanCode,
  formatFcfa,
} from './plans';

describe('billing plans catalogue', () => {
  it('exposes trial/growth/pro codes', () => {
    expect(BILLING_PLANS.map((p) => p.code)).toEqual(['trial', 'growth', 'pro']);
  });

  it('public offers are free 24h + Pro 80 000 only', () => {
    expect(PUBLIC_BILLING_PLANS.map((p) => p.code)).toEqual(['trial', 'pro']);
    expect(getPlan('trial')?.periodDays).toBe(1);
    expect(getPlan('pro')?.amountXaf).toBe(80000);
    expect(getPlan('pro')?.highlighted).toBe(true);
  });

  it('maps legacy codes', () => {
    expect(normalizePlanCode('starter')).toBe('growth');
    expect(normalizePlanCode('enterprise')).toBe('pro');
    expect(normalizePlanCode('trial')).toBe('trial');
  });

  it('marks paid plans', () => {
    expect(isPaidPlan('trial')).toBe(false);
    expect(isPaidPlan('growth')).toBe(true);
    expect(isPaidPlan('pro')).toBe(true);
    expect(getPlan('growth')?.amountXaf).toBe(19900);
  });

  it('formats FCFA', () => {
    expect(formatFcfa(80000)).toContain('FCFA');
  });
});
