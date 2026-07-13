import { describe, expect, it } from 'vitest';
import {
  isDuplicateWebhookEvent,
  parseMetaWebhookStatuses,
  validateMetaWebhookPayload,
} from './whatsapp-webhook';

describe('validateMetaWebhookPayload', () => {
  it('accepts whatsapp business account payloads', () => {
    expect(
      validateMetaWebhookPayload({ object: 'whatsapp_business_account', entry: [] }).valid
    ).toBe(true);
  });

  it('rejects invalid object type', () => {
    expect(validateMetaWebhookPayload({ object: 'page' }).reason).toBe('invalid_object_type');
  });
});

describe('isDuplicateWebhookEvent', () => {
  it('detects duplicate status+timestamp in webhook history', () => {
    const raw = {
      webhookHistory: [{ status: 'delivered', timestamp: '2026-01-01T00:00:00.000Z', processedAt: 'x' }],
    };
    expect(
      isDuplicateWebhookEvent(raw, {
        wamid: 'wamid.1',
        status: 'delivered',
        timestamp: '2026-01-01T00:00:00.000Z',
        raw: {},
      })
    ).toBe(true);
  });
});

describe('parseMetaWebhookStatuses', () => {
  it('extracts sent status', () => {
    const statuses = parseMetaWebhookStatuses({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.SENT', status: 'sent', timestamp: '1710000000' }] } }] }],
    });
    expect(statuses[0]?.status).toBe('sent');
  });

  it('extracts delivered and read statuses', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.DELIVERED',
                    status: 'delivered',
                    timestamp: '1710000000',
                    recipient_id: '221771234567',
                  },
                  {
                    id: 'wamid.READ',
                    status: 'read',
                    timestamp: '1710000060',
                    recipient_id: '221771234567',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const statuses = parseMetaWebhookStatuses(payload);
    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.wamid).toBe('wamid.DELIVERED');
    expect(statuses[0]?.status).toBe('delivered');
    expect(statuses[1]?.status).toBe('read');
  });

  it('extracts failed status with error message', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.FAILED',
                    status: 'failed',
                    timestamp: '1710000000',
                    errors: [{ code: 131026, title: 'Message undeliverable' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const statuses = parseMetaWebhookStatuses(payload);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.status).toBe('failed');
    expect(statuses[0]?.errorMessage).toBe('Message undeliverable');
  });

  it('dedupes identical status events in one payload', () => {
    const statuses = parseMetaWebhookStatuses({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.DUP', status: 'read', timestamp: '1710000000' },
                  { id: 'wamid.DUP', status: 'read', timestamp: '1710000000' },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(statuses).toHaveLength(1);
  });

  it('returns empty for non-whatsapp payloads', () => {
    expect(parseMetaWebhookStatuses({ object: 'page' })).toEqual([]);
    expect(parseMetaWebhookStatuses(null)).toEqual([]);
  });
});
