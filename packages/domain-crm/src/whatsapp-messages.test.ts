import { describe, expect, it } from 'vitest';
import { pickLatestDeliveryByCampaignSendId } from './whatsapp-messages';

describe('pickLatestDeliveryByCampaignSendId', () => {
  it('keeps the first (newest) row per campaign_send_id', () => {
    const map = pickLatestDeliveryByCampaignSendId([
      {
        campaign_send_id: 'send-1',
        status: 'read',
        sent_at: '2026-07-13T10:00:00.000Z',
        delivered_at: '2026-07-13T10:01:00.000Z',
        read_at: '2026-07-13T10:02:00.000Z',
        error_message: null,
        wamid: 'wamid.A',
        template_name: 'loyala_birthday_v1',
        created_at: '2026-07-13T10:02:00.000Z',
      },
      {
        campaign_send_id: 'send-1',
        status: 'sent',
        sent_at: '2026-07-13T09:00:00.000Z',
        delivered_at: null,
        read_at: null,
        error_message: null,
        wamid: 'wamid.B',
        template_name: null,
        created_at: '2026-07-13T09:00:00.000Z',
      },
      {
        campaign_send_id: 'send-2',
        status: 'delivered',
        sent_at: '2026-07-13T11:00:00.000Z',
        delivered_at: '2026-07-13T11:01:00.000Z',
        read_at: null,
        error_message: null,
        wamid: 'wamid.C',
        template_name: null,
        created_at: '2026-07-13T11:01:00.000Z',
      },
    ]);

    expect(map.size).toBe(2);
    expect(map.get('send-1')?.status).toBe('read');
    expect(map.get('send-1')?.wamid).toBe('wamid.A');
    expect(map.get('send-2')?.status).toBe('delivered');
  });

  it('skips rows without campaign_send_id', () => {
    const map = pickLatestDeliveryByCampaignSendId([
      {
        campaign_send_id: null,
        status: 'sent',
        sent_at: null,
        delivered_at: null,
        read_at: null,
        error_message: null,
        wamid: null,
        template_name: null,
        created_at: '2026-07-13T10:00:00.000Z',
      },
    ]);
    expect(map.size).toBe(0);
  });
});
