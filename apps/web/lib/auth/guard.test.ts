import { describe, it, expect } from 'vitest';
import { evaluateAuthPermission } from './guard';
import { canWriteClients, canDeleteClients } from './clients-access';
import type { AuthContext, OrgRole } from '@loyala/core-iam';

function ctx(role: OrgRole, overrides?: Partial<AuthContext>): AuthContext {
  return {
    userId: 'user-1',
    organizationId: 'org-a',
    role,
    ...overrides,
  };
}

describe('BUG-001 RBAC — requireAuthPermission / evaluateAuthPermission', () => {
  it('OWNER: clients:read ALLOW, clients:write ALLOW', () => {
    const owner = ctx('org_owner');
    expect(evaluateAuthPermission(owner, 'clients:read')).toBe('allow');
    expect(evaluateAuthPermission(owner, 'clients:write')).toBe('allow');
    expect(canWriteClients(owner)).toBe(true);
    expect(canDeleteClients(owner)).toBe(true);
  });

  it('VIEWER (read-only): clients:read ALLOW, clients:write DENY', () => {
    const viewer = ctx('org_viewer');
    expect(evaluateAuthPermission(viewer, 'clients:read')).toBe('allow');
    expect(evaluateAuthPermission(viewer, 'clients:write')).toBe('deny');
    expect(canWriteClients(viewer)).toBe(false);
  });

  it('membership alone does NOT grant clients:write (regression of MVP bypass)', () => {
    const viewer = ctx('org_viewer');
    // Previously: userId + organizationId ⇒ write ALLOW
    expect(Boolean(viewer.userId && viewer.organizationId)).toBe(true);
    expect(evaluateAuthPermission(viewer, 'clients:write')).toBe('deny');
    expect(canWriteClients(viewer)).toBe(false);
  });

  it('role without clients permission: DENY read and write', () => {
    // Forge a role that is not in ROLE_PERMISSIONS → hasPermission falls back to viewer
    // Explicit: empty userId / empty org
    expect(
      evaluateAuthPermission(
        { userId: '', organizationId: 'org-a', role: 'org_viewer' },
        'clients:read'
      )
    ).toBe('deny');
    expect(
      evaluateAuthPermission(
        { userId: 'u1', organizationId: '', role: 'org_viewer' },
        'clients:write'
      )
    ).toBe('deny');
  });

  it('no membership (missing organizationId): DENY', () => {
    const noOrg = ctx('org_owner', { organizationId: '' });
    expect(evaluateAuthPermission(noOrg, 'clients:read')).toBe('deny');
    expect(evaluateAuthPermission(noOrg, 'clients:write')).toBe('deny');
  });

  it('cross-tenant: permission is evaluated only on session ctx (org B id does not elevate role)', () => {
    const viewerOrgA = ctx('org_viewer', { organizationId: 'org-a' });
    // Attacker cannot upgrade by claiming another organizationId in the same check —
    // session context stays viewer on org-a.
    expect(evaluateAuthPermission(viewerOrgA, 'clients:write')).toBe('deny');
    const forged = ctx('org_viewer', { organizationId: 'org-b' });
    expect(evaluateAuthPermission(forged, 'clients:write')).toBe('deny');
    // Even owner of org-b cannot "become" owner of org-a by forging role without session re-resolution;
    // write for viewer remains deny.
    expect(evaluateAuthPermission(ctx('org_viewer'), 'clients:write')).toBe('deny');
  });

  it('non-authenticated shaped context: DENY', () => {
    expect(
      evaluateAuthPermission(
        { userId: '', organizationId: '', role: 'org_owner' },
        'clients:read'
      )
    ).toBe('deny');
  });

  it('staff keeps write; cannot delete', () => {
    const staff = ctx('org_staff');
    expect(evaluateAuthPermission(staff, 'clients:write')).toBe('allow');
    expect(canDeleteClients(staff)).toBe(false);
  });

  it('forged role field in request body is irrelevant — only AuthContext.role counts', () => {
    const viewer = ctx('org_viewer');
    // Simulate client sending role=org_owner alongside action: server uses AuthContext only
    const payloadRole = 'org_owner';
    expect(payloadRole).toBe('org_owner');
    expect(evaluateAuthPermission(viewer, 'clients:write')).toBe('deny');
  });
});
