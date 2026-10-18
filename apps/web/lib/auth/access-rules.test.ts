import { describe, expect, it } from 'vitest';
import type { AuthContext, OrgRole } from '@loyala/core-iam';
import { resolveOrgRole } from './role-map';
import { ORDER_SELF_EDIT_WINDOW_MS, canChangeOrder, canRefundOrder, isOwnRecentOrder } from './clients-access';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const ctx = (role: OrgRole, userId = 'me'): AuthContext => ({ userId, organizationId: 'org-a', role });

describe('resolveOrgRole — refus par défaut', () => {
  it.each([
    ['org_owner', 'org_owner'],
    ['  Propriétaire ', 'org_owner'],
    ['ADMIN', 'org_admin'],
    ['gestionnaire_organisation', 'org_admin'],
    ['manager', 'org_manager'],
    ['membre', 'org_staff'],
    ['viewer', 'org_viewer'],
  ])('reconnaît %s', (code, role) => {
    expect(resolveOrgRole(code)).toBe(role);
  });

  it.each([null, undefined, '', '   ', 'caissier_maison', 'superadmin', 'constructor', '__proto__', 'toString', 42])(
    'ne donne aucun rôle à %s (plus de propriétaire implicite)',
    (code) => {
      expect(resolveOrgRole(code)).toBeNull();
    }
  );
});

describe('commandes — modification, annulation, remboursement', () => {
  const own = (m: number) => ({ created_by: 'me', created_at: minutesAgo(m) });

  it('l’équipe modifie ou annule sa propre saisie de moins de 15 minutes', () => {
    expect(canChangeOrder(ctx('org_staff'), own(0), NOW)).toBe(true);
    expect(canChangeOrder(ctx('org_staff'), own(14.9), NOW)).toBe(true);
  });

  it('l’équipe ne touche plus sa saisie à 15 minutes et au-delà', () => {
    expect(canChangeOrder(ctx('org_staff'), own(15), NOW)).toBe(false);
    expect(canChangeOrder(ctx('org_staff'), own(60), NOW)).toBe(false);
  });

  it('l’équipe ne touche ni la commande d’un autre, ni une commande historique', () => {
    expect(canChangeOrder(ctx('org_staff'), { created_by: 'other', created_at: minutesAgo(1) }, NOW)).toBe(false);
    expect(canChangeOrder(ctx('org_staff'), { created_by: null, created_at: minutesAgo(1) }, NOW)).toBe(false);
    expect(canChangeOrder(ctx('org_staff'), { created_by: 'me', created_at: null }, NOW)).toBe(false);
    expect(canChangeOrder(ctx('org_staff'), { created_by: 'me', created_at: 'pas une date' }, NOW)).toBe(false);
  });

  it.each<OrgRole>(['org_owner', 'org_admin', 'org_manager'])('%s modifie ou annule toute commande', (role) => {
    expect(canChangeOrder(ctx(role), { created_by: 'other', created_at: minutesAgo(600) }, NOW)).toBe(true);
    expect(canChangeOrder(ctx(role), { created_by: null, created_at: null }, NOW)).toBe(true);
  });

  it('la lecture seule et un rôle invalide ne modifient rien, même leur propre saisie', () => {
    expect(canChangeOrder(ctx('org_viewer'), own(1), NOW)).toBe(false);
    expect(canChangeOrder(ctx('pirate' as OrgRole), own(1), NOW)).toBe(false);
  });

  it('remboursement : propriétaire, administrateur, gérant uniquement', () => {
    const roles: OrgRole[] = ['org_owner', 'org_admin', 'org_manager', 'org_staff', 'org_viewer'];
    expect(roles.map((r) => canRefundOrder(ctx(r)))).toEqual([true, true, true, false, false]);
    expect(canRefundOrder({ userId: 'me', organizationId: '', role: 'org_owner' })).toBe(false);
  });

  it('la fenêtre vaut 15 minutes, comme assert_order_change_allowed', () => {
    expect(ORDER_SELF_EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(isOwnRecentOrder(own(10), 'me', NOW)).toBe(true);
    expect(isOwnRecentOrder(own(10), 'someone-else', NOW)).toBe(false);
  });
});
