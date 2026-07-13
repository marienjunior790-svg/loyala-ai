import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computeMetaWebhookSignature,
  formatMetaWebhookSignature,
  verifyMetaWebhookSignature,
} from './webhook-security';

describe('verifyMetaWebhookSignature', () => {
  const secret = 'test-app-secret';
  const body = Buffer.from('{"object":"whatsapp_business_account"}');

  it('accepts valid sha256 signature', () => {
    const digest = computeMetaWebhookSignature(secret, body);
    const header = formatMetaWebhookSignature(digest);
    expect(verifyMetaWebhookSignature(body, header, secret)).toBe(true);
  });

  it('rejects tampered body', () => {
    const digest = computeMetaWebhookSignature(secret, body);
    const header = formatMetaWebhookSignature(digest);
    const tampered = Buffer.from('{"object":"page"}');
    expect(verifyMetaWebhookSignature(tampered, header, secret)).toBe(false);
  });

  it('rejects missing header', () => {
    expect(verifyMetaWebhookSignature(body, undefined, secret)).toBe(false);
  });
});
