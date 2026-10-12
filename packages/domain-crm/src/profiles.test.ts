import { describe, it, expect, vi } from 'vitest';
import { getMyProfile, listOrganizationTeam } from './profiles';

describe('listOrganizationTeam', () => {
  it('maps RPC rows with display names', async () => {
    const supabase = {
      rpc: vi.fn(async () => ({
        data: [
          {
            user_id: 'u1',
            full_name: 'Awa Diop',
            email: 'awa@example.com',
            role_code: 'org_owner',
            status: 'active',
            joined_at: '2026-07-08T00:00:00Z',
          },
        ],
        error: null,
      })),
    };

    const team = await listOrganizationTeam(supabase as never, 'org-1');
    expect(team).toEqual([
      {
        user_id: 'u1',
        full_name: 'Awa Diop',
        email: 'awa@example.com',
        role_code: 'org_owner',
        status: 'active',
        joined_at: '2026-07-08T00:00:00Z',
      },
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith('list_organization_team', {
      p_organization_id: 'org-1',
    });
  });

  it('falls back to memberships when the RPC is not deployed', async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [{ user_id: 'u1', status: 'active', joined_at: null, roles: { code: 'org_owner' } }],
          error: null,
        }),
    };
    const supabase = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'Could not find the function public.list_organization_team in the schema cache' },
      })),
      from: () => chain,
    };

    const team = await listOrganizationTeam(supabase as never, 'org-1');
    expect(team).toEqual([
      {
        user_id: 'u1',
        full_name: null,
        email: null,
        role_code: 'org_owner',
        status: 'active',
        joined_at: null,
      },
    ]);
  });
});

describe('getMyProfile', () => {
  it('returns null when the profiles table is missing', async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: null,
        error: { message: 'relation "public.profiles" does not exist' },
      }),
    };
    const supabase = { from: () => chain };
    await expect(getMyProfile(supabase as never, 'u1')).resolves.toBeNull();
  });
});
