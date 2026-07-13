import { describe, expect, it } from 'vitest';
import { parseMetaWebhookInboundMessages } from './whatsapp-webhook-inbound';

describe('parseMetaWebhookInboundMessages', () => {
  it('extracts inbound text messages', () => {
    const messages = parseMetaWebhookInboundMessages({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456' },
                messages: [
                  {
                    from: '221771234567',
                    id: 'wamid.INBOUND',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Bonjour' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.wamid).toBe('wamid.INBOUND');
    expect(messages[0]?.from).toBe('221771234567');
    expect(messages[0]?.body).toBe('Bonjour');
    expect(messages[0]?.phoneNumberId).toBe('123456');
  });

  it('dedupes identical inbound events', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '221771234567',
                    id: 'wamid.DUP',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Hi' },
                  },
                  {
                    from: '221771234567',
                    id: 'wamid.DUP',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Hi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseMetaWebhookInboundMessages(payload)).toHaveLength(1);
  });

  it('returns empty for non-whatsapp payloads', () => {
    expect(parseMetaWebhookInboundMessages({ object: 'page' })).toEqual([]);
  });
});
