import { describe, expect, it } from 'vitest';
import type { Campaign } from './campaigns';
import { isCampaignDue, resolveCampaignScheduledAt } from './scheduled-campaigns';

const baseCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 'camp-1',
  organization_id: 'org-1',
  type: 'promotion',
  name: 'Promo été',
  status: 'scheduled',
  message_preview: 'Bonjour',
  target_count: 0,
  metadata: {},
  scheduled_at: '2026-01-01T10:00:00.000Z',
  created_at: '2025-12-01T00:00:00.000Z',
  ...overrides,
});

describe('resolveCampaignScheduledAt', () => {
  it('prefers scheduled_at column', () => {
    expect(
      resolveCampaignScheduledAt(
        baseCampaign({
          scheduled_at: '2026-01-01T10:00:00.000Z',
          metadata: { scheduledAt: '2026-02-01T10:00:00.000Z' },
        })
      )
    ).toBe('2026-01-01T10:00:00.000Z');
  });

  it('falls back to metadata.scheduledAt', () => {
    expect(
      resolveCampaignScheduledAt(
        baseCampaign({
          scheduled_at: null,
          metadata: { scheduledAt: '2026-02-01T10:00:00.000Z' },
        })
      )
    ).toBe('2026-02-01T10:00:00.000Z');
  });
});

describe('isCampaignDue', () => {
  it('returns true when scheduled_at is in the past', () => {
    expect(
      isCampaignDue(
        baseCampaign({ scheduled_at: '2020-01-01T10:00:00.000Z' }),
        new Date('2026-01-01T12:00:00.000Z')
      )
    ).toBe(true);
  });

  it('returns false when scheduled_at is in the future', () => {
    expect(
      isCampaignDue(
        baseCampaign({ scheduled_at: '2030-01-01T10:00:00.000Z' }),
        new Date('2026-01-01T12:00:00.000Z')
      )
    ).toBe(false);
  });

  it('supports legacy ready + schedulePendingMigration metadata', () => {
    expect(
      isCampaignDue(
        baseCampaign({
          status: 'ready',
          scheduled_at: null,
          metadata: {
            scheduledAt: '2020-01-01T10:00:00.000Z',
            schedulePendingMigration: true,
          },
        }),
        new Date('2026-01-01T12:00:00.000Z')
      )
    ).toBe(true);
  });
});
