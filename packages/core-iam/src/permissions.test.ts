import { describe, it, expect } from 'vitest';
import { hasPermission } from '../src/permissions';

describe('@loyala/core-iam permissions', () => {
  const owner = { userId: 'u1', organizationId: 'o1', role: 'org_owner' as const };
  const staff = { userId: 'u2', organizationId: 'o1', role: 'org_staff' as const };
  const viewer = { userId: 'u3', organizationId: 'o1', role: 'org_viewer' as const };

  it('owner can delete clients', () => {
    expect(hasPermission(owner, 'clients:delete')).toBe(true);
  });

  it('staff cannot delete clients', () => {
    expect(hasPermission(staff, 'clients:delete')).toBe(false);
  });

  it('staff can write clients', () => {
    expect(hasPermission(staff, 'clients:write')).toBe(true);
  });

  it('viewer can only read clients', () => {
    expect(hasPermission(viewer, 'clients:read')).toBe(true);
    expect(hasPermission(viewer, 'clients:write')).toBe(false);
  });

  it('only owner, admin and manager can adjust loyalty points by hand', () => {
    const admin = { userId: 'u5', organizationId: 'o1', role: 'org_admin' as const };
    const manager = { userId: 'u6', organizationId: 'o1', role: 'org_manager' as const };
    expect(hasPermission(owner, 'loyalty:adjust')).toBe(true);
    expect(hasPermission(admin, 'loyalty:adjust')).toBe(true);
    expect(hasPermission(manager, 'loyalty:adjust')).toBe(true);
    expect(hasPermission(staff, 'loyalty:adjust')).toBe(false);
    expect(hasPermission(viewer, 'loyalty:adjust')).toBe(false);
  });

  it('undefined role never grants loyalty adjustments', () => {
    const broken = { userId: 'u7', organizationId: 'o1', role: undefined as unknown as 'org_owner' };
    expect(hasPermission(broken, 'loyalty:adjust')).toBe(false);
  });

  it.each([undefined, null, '', 'caissier_maison', 'owner', 'ORG_OWNER'])(
    'denies every permission to a missing or unknown role (%s)',
    (role) => {
      const broken = { userId: 'u4', organizationId: 'o1', role: role as unknown as 'org_owner' };
      for (const permission of ['org:read', 'clients:read', 'clients:write', 'orders:refund'] as const) {
        expect(hasPermission(broken, permission)).toBe(false);
      }
    }
  );

  it('only owner, admin and manager can refund or change any order', () => {
    const admin = { userId: 'u5', organizationId: 'o1', role: 'org_admin' as const };
    const manager = { userId: 'u6', organizationId: 'o1', role: 'org_manager' as const };
    for (const permission of ['orders:refund', 'orders:manage'] as const) {
      expect([owner, admin, manager, staff, viewer].map((c) => hasPermission(c, permission))).toEqual([
        true,
        true,
        true,
        false,
        false,
      ]);
    }
  });
});
