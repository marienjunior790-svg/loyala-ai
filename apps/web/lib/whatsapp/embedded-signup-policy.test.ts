import { describe, expect, it } from 'vitest';
import {
  canManageWhatsAppEmbeddedSignup,
  resolveEmbeddedSignupOrganizationId,
} from './embedded-signup-policy';

const base = { userId: 'u1', organizationId: 'org-session' };

describe('embedded signup policy', () => {
  it('refuse un utilisateur sans permission settings', () => {
    expect(canManageWhatsAppEmbeddedSignup({ ...base, role: 'org_staff' })).toBe(false);
    expect(canManageWhatsAppEmbeddedSignup({ ...base, role: 'org_viewer' })).toBe(false);
    expect(canManageWhatsAppEmbeddedSignup({ ...base, role: 'org_manager' })).toBe(false);
  });

  it('autorise owner/admin', () => {
    expect(canManageWhatsAppEmbeddedSignup({ ...base, role: 'org_owner' })).toBe(true);
    expect(canManageWhatsAppEmbeddedSignup({ ...base, role: 'org_admin' })).toBe(true);
  });

  it('ignore un organizationId client falsifié', () => {
    expect(resolveEmbeddedSignupOrganizationId('org-session', 'org-attacker')).toBe('org-session');
    expect(resolveEmbeddedSignupOrganizationId('org-session')).toBe('org-session');
  });
});
