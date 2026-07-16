import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OpenPayCgClient } from './client';
import { verifyOpenPayWebhook } from './webhook-verify';

describe('OpenPayCgClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENPAY_STATUS_PATH;
  });

  it('creates payment with XO-API-KEY', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ id: 'tx_1', status: 'pending' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenPayCgClient({ apiKey: 'test-key' });
    const result = await client.createPayment({
      amount: 19900,
      paymentPhoneNumber: '242061234567',
      provider: 'MTN',
    });

    expect(result.ok).toBe(true);
    expect(result.providerTxId).toBe('tx_1');
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)['XO-API-KEY']).toBe('test-key');
  });

  it('refuses refunds without public docs', async () => {
    const client = new OpenPayCgClient({ apiKey: 'test-key' });
    const result = await client.refund('tx_1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not documented/i);
  });

  it('status poll fails closed without OPENPAY_STATUS_PATH', async () => {
    const client = new OpenPayCgClient({ apiKey: 'test-key' });
    const result = await client.getPaymentStatus('tx_1');
    expect(result.status).toBe('unknown');
    expect(result.error).toMatch(/not documented/i);
  });
});

describe('verifyOpenPayWebhook', () => {
  it('accepts when secret unset', () => {
    const r = verifyOpenPayWebhook({}, '{}', undefined);
    expect(r.ok).toBe(true);
  });

  it('rejects bad signature when secret set', () => {
    const r = verifyOpenPayWebhook({ 'x-openpay-signature': 'bad' }, '{}', 'secret');
    expect(r.ok).toBe(false);
  });

  it('accepts matching shared secret', () => {
    const r = verifyOpenPayWebhook({ 'x-openpay-signature': 'secret' }, '{}', 'secret');
    expect(r.ok).toBe(true);
  });
});
