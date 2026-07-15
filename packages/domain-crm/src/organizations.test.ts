import { describe, expect, it, vi } from 'vitest';
import { getOrganization, listOrganizationMembers } from './organizations';

function mockClient(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let i = 0;
  const maybeSingle = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return r;
  });
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle,
  };
  return {
    from: () => chain,
    _maybeSingle: maybeSingle,
  };
}

describe('getOrganization schema fallback', () => {
  it('falls back when plan_status / deleted_at missing then succeeds', async () => {
    const client = mockClient([
      { data: null, error: { message: 'column organizations.deleted_at does not exist' } },
      { data: null, error: { message: 'column organizations.plan_status does not exist' } },
      {
        data: { id: 'o1', name: 'Chez Alice', slug: 'chez-alice', settings: {} },
        error: null,
      },
    ]);

    const org = await getOrganization(client as never, 'o1');
    expect(org?.name).toBe('Chez Alice');
    expect(org?.plan_status).toBe('trialing');
    expect(client._maybeSingle).toHaveBeenCalledTimes(3);
  });
});

describe('listOrganizationMembers', () => {
  it('falls back when PostgREST roles relationship is missing', async () => {
    const membersThen = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find a relationship between 'organization_members' and 'roles' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            user_id: 'u1',
            status: 'active',
            joined_at: '2026-01-01',
            role_id: 'r1',
          },
        ],
        error: null,
      });

    const rolesThen = vi.fn(async () => ({
      data: [{ id: 'r1', code: 'org_owner' }],
      error: null,
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'organization_members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => membersThen(),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: () => ({
              in: () => rolesThen(),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const members = await listOrganizationMembers(supabase as never, 'org-1');
    expect(members).toEqual([
      {
        user_id: 'u1',
        role_code: 'org_owner',
        status: 'active',
        joined_at: '2026-01-01',
      },
    ]);
    expect(membersThen).toHaveBeenCalledTimes(2);
    expect(rolesThen).toHaveBeenCalledTimes(1);
  });
});
