import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext, OrgRole } from '@loyala/core-iam';

const requireAuthPermission = vi.fn<() => Promise<AuthContext>>();
const cancelClientOrder = vi.fn();
const refundClientOrder = vi.fn();
const updateClientVisit = vi.fn();

type Authorship = { created_by: string | null; created_at: string | null } | null;
let authorship: Authorship = null;
const filters: [string, unknown][] = [];
const supabase = {
  from: vi.fn(() => {
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      maybeSingle: async () => ({ data: authorship, error: null }),
    };
    return query;
  }),
};
const createClient = vi.fn(async () => supabase);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/guard', () => ({ requireAuthPermission: () => requireAuthPermission() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }));
vi.mock('@/lib/audit/record-domain-event', () => ({ recordDomainEvent: vi.fn(async () => undefined) }));
vi.mock('@loyala/domain-crm', () => ({
  cancelClientOrder: (...args: unknown[]) => cancelClientOrder(...args),
  refundClientOrder: (...args: unknown[]) => refundClientOrder(...args),
  updateClientVisit: (...args: unknown[]) => updateClientVisit(...args),
}));

const { cancelVisitAction, refundVisitAction, updateVisitAction } = await import(
  '../app/(dashboard)/clients/_actions/visits'
);

const ORDER = '11111111-1111-4111-8111-111111111111';
const CLIENT = '22222222-2222-4222-8222-222222222222';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const session = (role: OrgRole): AuthContext => ({ userId: 'me', organizationId: 'org-a', role });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const cancelForm = () => form({ visitId: ORDER, clientId: CLIENT, reason: 'Erreur de saisie' });
const refundForm = () => form({ visitId: ORDER, clientId: CLIENT, amount: '500', reason: 'Plat froid' });
const updateForm = () => form({ visitId: ORDER, clientId: CLIENT, visitedAt: '2026-10-14', amount: '2500' });

describe('actions commandes — droits par rôle', () => {
  beforeEach(() => {
    for (const fn of [requireAuthPermission, cancelClientOrder, refundClientOrder, updateClientVisit]) fn.mockReset();
    createClient.mockClear();
    filters.length = 0;
    authorship = null;
    cancelClientOrder.mockResolvedValue({ order: { id: ORDER, amount: 1000, source: 'manual' }, pointsDelta: -1 });
    refundClientOrder.mockResolvedValue({ order: { id: ORDER }, pointsDelta: 0 });
    updateClientVisit.mockResolvedValue({ pointsDelta: 0 });
  });

  it.each<OrgRole>(['org_staff', 'org_viewer'])('remboursement refusé à %s sans toucher à la base', async (role) => {
    requireAuthPermission.mockResolvedValue(session(role));
    const result = await refundVisitAction({}, refundForm());
    expect(result.error).toMatch(/gérant/);
    expect(createClient).not.toHaveBeenCalled();
    expect(refundClientOrder).not.toHaveBeenCalled();
  });

  it.each<OrgRole>(['org_owner', 'org_admin', 'org_manager'])('remboursement autorisé à %s', async (role) => {
    requireAuthPermission.mockResolvedValue(session(role));
    const result = await refundVisitAction({}, refundForm());
    expect(result.success).toMatch(/Remboursement enregistré/);
    expect(refundClientOrder).toHaveBeenCalledWith(supabase, 'org-a', expect.objectContaining({ reason: 'Plat froid' }));
  });

  it('l’équipe annule sa propre saisie de 5 minutes', async () => {
    requireAuthPermission.mockResolvedValue(session('org_staff'));
    authorship = { created_by: 'me', created_at: minutesAgo(5) };
    const result = await cancelVisitAction({}, cancelForm());
    expect(result.success).toMatch(/Commande annulée/);
    expect(filters).toEqual([
      ['id', ORDER],
      ['organization_id', 'org-a'],
    ]);
  });

  it.each([
    ['sa saisie de plus de 15 minutes', { created_by: 'me', created_at: minutesAgo(16) }],
    ['la commande d’un autre membre', { created_by: 'other', created_at: minutesAgo(1) }],
    ['une commande historique', { created_by: null, created_at: minutesAgo(1) }],
  ])('l’équipe ne peut pas annuler ni modifier %s', async (_label, order) => {
    requireAuthPermission.mockResolvedValue(session('org_staff'));
    authorship = order;
    expect((await cancelVisitAction({}, cancelForm())).error).toMatch(/seul un gérant/);
    expect((await updateVisitAction({}, updateForm())).error).toMatch(/seul un gérant/);
    expect(cancelClientOrder).not.toHaveBeenCalled();
    expect(updateClientVisit).not.toHaveBeenCalled();
  });

  it('le gérant annule et modifie la commande ancienne d’un autre membre', async () => {
    requireAuthPermission.mockResolvedValue(session('org_manager'));
    authorship = { created_by: 'other', created_at: minutesAgo(600) };
    expect((await cancelVisitAction({}, cancelForm())).success).toMatch(/Commande annulée/);
    expect((await updateVisitAction({}, updateForm())).success).toMatch(/Commande mise à jour/);
  });

  it('une commande absente du restaurant de la session est introuvable', async () => {
    requireAuthPermission.mockResolvedValue(session('org_owner'));
    authorship = null;
    expect((await cancelVisitAction({}, cancelForm())).error).toBe('Commande introuvable');
    expect(cancelClientOrder).not.toHaveBeenCalled();
  });
});
