import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearWebhookReplayCache,
  isReplayedWebhook,
  markWebhookProcessed,
  buildWebhookDedupeKey,
} from './webhook-replay';

describe('webhook replay cache', () => {
  beforeEach(() => clearWebhookReplayCache());
  afterEach(() => clearWebhookReplayCache());

  it('blocks duplicate keys within TTL window', () => {
    const key = buildWebhookDedupeKey('wamid.ABC', 'delivered', '2026-01-01T00:00:00.000Z');
    expect(isReplayedWebhook(key)).toBe(false);
    markWebhookProcessed(key);
    expect(isReplayedWebhook(key)).toBe(true);
  });
});
