import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@loyala/domain-crm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loyala/domain-crm')>();
  return {
    ...actual,
    applyMetaWebhookStatus: vi.fn(async () => 'updated' as const),
    applyMetaWebhookInboundMessages: vi.fn(async () => ({
      processed: 1,
      skipped: 0,
      sessionsUpdated: 1,
      clientsMatched: 1,
      matched: [],
    })),
  };
});

import {
  handleWhatsAppWebhookVerify,
  handleWhatsAppWebhookPost,
  clearWebhookReplayCache,
} from './webhook';
import {
  computeMetaWebhookSignature,
  formatMetaWebhookSignature,
} from './webhook-security';

const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [
              { id: 'wamid.SENT', status: 'sent', timestamp: '1710000000' },
              { id: 'wamid.SENT', status: 'sent', timestamp: '1710000000' },
            ],
          },
        },
      ],
    },
  ],
};

function signedRequest(body: Buffer, secret: string) {
  return {
    rawBody: body,
    headers: {
      'x-hub-signature-256': formatMetaWebhookSignature(computeMetaWebhookSignature(secret, body)),
    },
  };
}

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

describe('handleWhatsAppWebhookPost', () => {
  const originalEnv = { NODE_ENV: process.env.NODE_ENV, WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET };

  beforeEach(() => {
    clearWebhookReplayCache();
    process.env.NODE_ENV = 'test';
    process.env.WHATSAPP_APP_SECRET = 'webhook-test-secret';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.WHATSAPP_APP_SECRET === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = originalEnv.WHATSAPP_APP_SECRET;
    clearWebhookReplayCache();
  });

  it('rejects invalid signature in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const body = Buffer.from(JSON.stringify(payload));
    const result = await handleWhatsAppWebhookPost(body, {
      'x-hub-signature-256': 'sha256=deadbeef'.padEnd(71, '0'),
    });
    expect(result.status).toBe(401);
    expect(result.data.reason).toBe('invalid_signature');
  });

  it('accepts valid signature and dedupes batch statuses', async () => {
    const body = Buffer.from(JSON.stringify(payload));
    const { rawBody, headers } = signedRequest(body, 'webhook-test-secret');
    const result = await handleWhatsAppWebhookPost(rawBody, headers);
    expect(result.status).toBe(200);
    expect(result.data.ok).toBe(true);
    expect(result.data.processed).toBe(1);
    expect(result.data.updated).toBe(1);
  });

  it('processes inbound messages and updates session stats', async () => {
    const inboundPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '221771234567',
                    id: 'wamid.IN',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Oui' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const body = Buffer.from(JSON.stringify(inboundPayload));
    const { rawBody, headers } = signedRequest(body, 'webhook-test-secret');
    const result = await handleWhatsAppWebhookPost(rawBody, headers);
    expect(result.status).toBe(200);
    expect(result.data.inboundProcessed).toBe(1);
    expect(result.data.inboundSessionsUpdated).toBe(1);
  });
});
