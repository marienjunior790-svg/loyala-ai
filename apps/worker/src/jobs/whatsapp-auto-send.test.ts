import { describe, expect, it } from 'vitest';
import type { CampaignSend } from '@loyala/domain-crm';
import { isEligibleForAutoSend } from './whatsapp-auto-send';

const baseSend = (overrides: Partial<CampaignSend> = {}): CampaignSend => ({
  id: 'send-1',
  organization_id: 'org-1',
  campaign_id: 'camp-1',
  client_id: 'client-abc',
  channel: 'whatsapp',
  message_body: 'Bonjour',
  status: 'pending',
  whatsapp_url: 'https://wa.me/24265719922',
  sent_at: null,
  created_at: '2026-01-01T00:00:00Z',
  clients: { full_name: 'Jean Test', phone: '065719922' },
  ...overrides,
});

describe('isEligibleForAutoSend', () => {
  it('matches by test client id', () => {
    expect(
      isEligibleForAutoSend(baseSend(), { testClientId: 'client-abc' })
    ).toBe(true);
    expect(
      isEligibleForAutoSend(baseSend(), { testClientId: 'other-client' })
    ).toBe(false);
  });

  it('matches by normalized test phone', () => {
    expect(isEligibleForAutoSend(baseSend(), { testPhone: '065719922' })).toBe(true);
    expect(isEligibleForAutoSend(baseSend(), { testPhone: '221771234567' })).toBe(false);
  });

  it('returns false when no gate configured', () => {
    expect(isEligibleForAutoSend(baseSend(), {})).toBe(false);
  });
});
