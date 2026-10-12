import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  PUBLIC_BILLING_PLANS,
  getPlan,
  isPaidPlan,
  normalizePlanCode,
  formatFcfa,
  formatEur,
  formatPaymentAmount,
  xafToEur,
  xafToEurCents,
} from './plans';

describe('billing plans catalogue', () => {
  it('exposes trial/growth/pro codes', () => {
    expect(BILLING_PLANS.map((p) => p.code)).toEqual(['trial', 'growth', 'pro']);
  });

  it('public offers are Gratuit, Pro 30 000 and Pro+ 80 000', () => {
    expect(PUBLIC_BILLING_PLANS.map((p) => p.name)).toEqual(['Gratuit', 'Pro', 'Pro+']);
    expect(getPlan('trial')?.amountXaf).toBe(0);
    expect(getPlan('growth')?.amountXaf).toBe(30000);
    expect(getPlan('pro')?.amountXaf).toBe(80000);
    expect(getPlan('growth')?.highlighted).toBe(true);
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
  });

  it('formats FCFA', () => {
    expect(formatFcfa(80000)).toContain('FCFA');
  });

  it('converts FCFA to euros at the fixed parity', () => {
    expect(xafToEur(30000)).toBe(45.73);
    expect(xafToEur(80000)).toBe(121.96);
    expect(xafToEur(655957)).toBe(1000);
    expect(formatEur(30000).replace(/\s/g, ' ')).toBe('45,73 €');
    expect(formatEur(0).replace(/\s/g, ' ')).toBe('0 €');
  });

  it('charges cards in euro cents', () => {
    expect(xafToEurCents(30000)).toBe(4573);
    expect(xafToEurCents(80000)).toBe(12196);
  });

  it('formats stored payment amounts by currency', () => {
    expect(formatPaymentAmount(4573, 'EUR').replace(/\s/g, ' ')).toBe('45,73 €');
    expect(formatPaymentAmount(30000, 'XAF').replace(/\s/g, ' ')).toBe('45,73 € (30 000 FCFA)');
  });
});
