import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext, OrgRole } from '@loyala/core-iam';

const requireAuth = vi.fn<() => Promise<AuthContext>>();
const addLoyaltyPoints = vi.fn();
const createClient = vi.fn(async () => ({}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/guard', () => ({ requireAuth: () => requireAuth() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }));
vi.mock('@loyala/domain-crm', () => ({
  addLoyaltyPoints: (...args: unknown[]) => addLoyaltyPoints(...args),
}));

const { addPointsAction } = await import('../app/(dashboard)/loyalty/_actions/loyalty');

function session(role: OrgRole, organizationId = 'org-a'): AuthContext {
  return { userId: 'user-1', organizationId, role };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validForm = () => form({ clientId: 'client-1', points: '50', reason: 'Bonus' });

describe('addPointsAction — ajustement manuel des points', () => {
  beforeEach(() => {
    requireAuth.mockReset();
    addLoyaltyPoints.mockReset();
    createClient.mockClear();
  });

  it.each<OrgRole>(['org_staff', 'org_viewer'])('refuse le rôle %s sans toucher à la base', async (role) => {
    requireAuth.mockResolvedValue(session(role));
    const result = await addPointsAction({}, validForm());
    expect(result.error).toMatch(/propriétaire/);
    expect(createClient).not.toHaveBeenCalled();
    expect(addLoyaltyPoints).not.toHaveBeenCalled();
  });

  it('refuse une session sans restaurant', async () => {
    requireAuth.mockResolvedValue(session('org_owner', ''));
    const result = await addPointsAction({}, validForm());
    expect(result.error).toBeDefined();
    expect(addLoyaltyPoints).not.toHaveBeenCalled();
  });

  it.each<OrgRole>(['org_owner', 'org_admin', 'org_manager'])('autorise le rôle %s sur son propre restaurant', async (role) => {
    requireAuth.mockResolvedValue(session(role));
    addLoyaltyPoints.mockResolvedValue({ newBalance: 150 });
    const result = await addPointsAction({}, validForm());
    expect(result).toEqual({ success: 'Nouveau solde : 150 points' });
    expect(addLoyaltyPoints).toHaveBeenCalledWith({}, 'org-a', {
      clientId: 'client-1',
      pointsDelta: 50,
      reason: 'Bonus',
    });
  });

  it('ignore un restaurant envoyé dans le formulaire : seul celui de la session compte', async () => {
    requireAuth.mockResolvedValue(session('org_manager', 'org-a'));
    addLoyaltyPoints.mockResolvedValue({ newBalance: 10 });
    await addPointsAction({}, form({ clientId: 'client-1', points: '10', organizationId: 'org-b' }));
    expect(addLoyaltyPoints.mock.calls[0]?.[1]).toBe('org-a');
  });

  it('refuse des points non entiers', async () => {
    requireAuth.mockResolvedValue(session('org_owner'));
    const result = await addPointsAction({}, form({ clientId: 'client-1', points: '2.5' }));
    expect(result.error).toMatch(/entier/);
    expect(addLoyaltyPoints).not.toHaveBeenCalled();
  });
});
