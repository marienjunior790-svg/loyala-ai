import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { handleWhatsAppWebhookVerify } from './webhook';

describe('handleWhatsAppWebhookVerify', () => {
  const original = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    else process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = original;
  });

  it('returns challenge when verify token matches', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': '1234567890',
    });

    const result = handleWhatsAppWebhookVerify(params);
    expect(result.status).toBe(200);
    expect(result.body).toBe('1234567890');
  });

  it('rejects invalid verify token', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '1234567890',
    });

    const result = handleWhatsAppWebhookVerify(params);
    expect(result.status).toBe(403);
  });
});
