import { afterEach, describe, expect, it, vi } from 'vitest';
import { bankTransferReference, isPaymentMethodLive } from './payment-methods';

describe('payment methods', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('builds a stable bank transfer reference', () => {
    expect(bankTransferReference('3f2a9c1e-77aa-4b1b-9c1d-000000000000', 'Pro+')).toBe(
      'LOYALA-PROPLUS-3F2A9C1E'
    );
    expect(bankTransferReference('abcd1234-0000', 'Pro')).toBe('LOYALA-PRO-ABCD1234');
  });

  it('keeps card and PayPal off until configured', () => {
    expect(isPaymentMethodLive('mobile_money')).toBe(true);
    expect(isPaymentMethodLive('bank_transfer')).toBe(true);
    expect(isPaymentMethodLive('card')).toBe(false);
    expect(isPaymentMethodLive('paypal')).toBe(false);
    vi.stubEnv('PAYPAL_ENABLED', 'true');
    expect(isPaymentMethodLive('paypal')).toBe(true);
  });

  it('needs both the flag and the Stripe key for cards', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('CARD_PAYMENTS_ENABLED', 'true');
    expect(isPaymentMethodLive('card')).toBe(false);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    expect(isPaymentMethodLive('card')).toBe(true);
  });
});
