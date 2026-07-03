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
});
