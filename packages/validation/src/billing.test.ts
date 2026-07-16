import { describe, expect, it } from 'vitest';
import { checkoutSchema, congoPhoneSchema } from './billing';

describe('billing validation', () => {
  it('normalizes Congo phones', () => {
    expect(congoPhoneSchema.parse('065719922')).toBe('24265719922');
    expect(congoPhoneSchema.parse('242061234567')).toBe('242061234567');
  });

  it('rejects invalid checkout', () => {
    const r = checkoutSchema.safeParse({
      planCode: 'trial',
      phone: '123',
      providerNetwork: 'MTN',
    });
    expect(r.success).toBe(false);
  });

  it('accepts growth + MTN', () => {
    const r = checkoutSchema.parse({
      planCode: 'growth',
      phone: '0600000000',
      providerNetwork: 'MTN',
    });
    expect(r.planCode).toBe('growth');
    expect(r.phone.startsWith('242')).toBe(true);
  });
});
