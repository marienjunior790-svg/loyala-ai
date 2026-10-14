import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> | null;
let user: { id: string } | null = { id: 'me' };
let membership: { organization_id: string; role_code?: string | null } | null = null;
let memberRow: Row = null;
let memberError: { message: string } | null = null;
let roleRow: Row = null;

const supabase = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () =>
        table === 'organization_members'
          ? { data: memberRow, error: memberError }
          : { data: roleRow, error: null },
    };
    return query;
  },
};

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }));
vi.mock('@/lib/supabase/env', () => ({ getSupabaseEnv: () => ({ url: '' }), getServiceRoleKey: () => '' }));
vi.mock('@loyala/db', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/auth/membership', () => ({ getActiveMembership: async () => membership }));

const { getAuthAccess, getAuthContext } = await import('../lib/auth/session');
const { requireAuth } = await import('../lib/auth/guard');

describe('accès au restaurant — refus par défaut', () => {
  beforeEach(() => {
    user = { id: 'me' };
    membership = { organization_id: 'org-a' };
    memberRow = null;
    memberError = null;
    roleRow = null;
  });

  it('rôle reconnu renvoyé par la base : accès avec ce rôle', async () => {
    membership = { organization_id: 'org-a', role_code: 'org_staff' };
    expect(await getAuthAccess()).toEqual({
      status: 'ok',
      ctx: { userId: 'me', organizationId: 'org-a', role: 'org_staff' },
    });
  });

  it('rôle relu dans la table quand la base ne le renvoie pas', async () => {
    memberRow = { role_id: 'r1' };
    roleRow = { code: 'manager' };
    expect(await getAuthContext()).toEqual({ userId: 'me', organizationId: 'org-a', role: 'org_manager' });
  });

  it.each([
    ['code inconnu', () => (membership = { organization_id: 'org-a', role_code: 'caissier_maison' })],
    ['code hérité de l’objet JavaScript', () => (membership = { organization_id: 'org-a', role_code: 'constructor' })],
    ['membre sans rôle', () => (memberRow = { role_id: null })],
    ['lecture du membre en échec', () => (memberError = { message: 'permission denied' })],
    ['rôle introuvable', () => (memberRow = { role_id: 'r-supprime' })],
  ])('%s : accès refusé, plus de propriétaire implicite', async (_label, arrange) => {
    arrange();
    expect(await getAuthAccess()).toEqual({ status: 'denied', userId: 'me', organizationId: 'org-a' });
    expect(await getAuthContext()).toBeNull();
    await expect(requireAuth()).rejects.toThrow('REDIRECT /acces-refuse');
  });

  it('sans restaurant : onboarding ; sans session : connexion', async () => {
    membership = null;
    await expect(requireAuth()).rejects.toThrow('REDIRECT /onboarding');
    user = null;
    await expect(requireAuth()).rejects.toThrow('REDIRECT /login');
  });
});
