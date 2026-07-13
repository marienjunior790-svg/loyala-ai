import { describe, expect, it } from 'vitest';
import { parseMetaWebhookStatuses } from './whatsapp-webhook';

describe('parseMetaWebhookStatuses', () => {
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

  it('returns empty for non-whatsapp payloads', () => {
    expect(parseMetaWebhookStatuses({ object: 'page' })).toEqual([]);
    expect(parseMetaWebhookStatuses(null)).toEqual([]);
  });
});
