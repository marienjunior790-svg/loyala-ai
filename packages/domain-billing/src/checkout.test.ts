import { describe, expect, it, vi } from 'vitest';
import { findBlockingPendingPayment, startCheckout } from './checkout';

describe('startCheckout anti-double', () => {
  it('blocks when pending payment exists', async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: 'pay-pending' }, error: null }));
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              gte: () => ({
                limit: () => ({
                  maybeSingle,
                }),
              }),
            }),
          }),
        }),
      })),
    };

    const blocking = await findBlockingPendingPayment(supabase as never, 'org-1');
    expect(blocking?.id).toBe('pay-pending');

    const result = await startCheckout(supabase as never, {
      organizationId: 'org-1',
      planCode: 'growth',
      phone: '242061234567',
      providerNetwork: 'MTN',
      openPayResult: { ok: true, providerTxId: 'tx', raw: {} },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/déjà en cours/i);
  });
});
