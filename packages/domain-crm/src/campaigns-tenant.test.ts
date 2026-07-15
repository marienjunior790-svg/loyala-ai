import { describe, expect, it, vi } from 'vitest';
import { createCampaign } from './campaigns';

describe('createCampaign tenant_id legacy', () => {
  it('retries insert with tenant_id when NOT NULL constraint fails', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'null value in column "tenant_id" of relation "campaigns" violates not-null constraint',
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'c1',
          organization_id: 'org-1',
          tenant_id: 'org-1',
          type: 'manual',
          name: 'Promo',
          status: 'ready',
        },
        error: null,
      });

    const supabase = {
      from: vi.fn(() => ({
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const result = await insert(row);
              return result;
            },
          }),
        }),
      })),
    };

    const campaign = await createCampaign(supabase as never, 'org-1', {
      type: 'manual',
      name: 'Promo',
    });

    expect(campaign.id).toBe('c1');
    expect(insert).toHaveBeenCalledTimes(2);
    const secondRow = insert.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(secondRow.tenant_id).toBe('org-1');
    expect(secondRow.organization_id).toBe('org-1');
  });
});
