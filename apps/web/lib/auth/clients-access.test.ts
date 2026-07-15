import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@loyala/core-iam';

function ctx(partial: Partial<AuthContext>): AuthContext {
  return {
    userId: partial.userId ?? 'user-1',
    organizationId: partial.organizationId ?? 'org-1',
    role: partial.role ?? 'org_viewer',
  };
}

describe('clients-access MVP bypass', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  it('allows org_viewer write when CRM_MVP_CLIENTS_BYPASS is default/true', async () => {
    delete process.env.CRM_MVP_CLIENTS_BYPASS;
    const { canWriteClients, canReadClients, isCrmMvpClientsBypassEnabled } =
      await import('./clients-access');
    expect(isCrmMvpClientsBypassEnabled()).toBe(true);
    expect(canWriteClients(ctx({ role: 'org_viewer' }))).toBe(true);
    expect(canReadClients(ctx({ role: 'org_viewer' }))).toBe(true);
  });

  it('denies org_viewer write when CRM_MVP_CLIENTS_BYPASS=false', async () => {
    process.env.CRM_MVP_CLIENTS_BYPASS = 'false';
    const { canWriteClients, canDeleteClients } = await import('./clients-access');
    expect(canWriteClients(ctx({ role: 'org_viewer' }))).toBe(false);
    expect(canWriteClients(ctx({ role: 'org_staff' }))).toBe(true);
    expect(canDeleteClients(ctx({ role: 'org_viewer' }))).toBe(false);
  });

  it('never bypasses delete', async () => {
    process.env.CRM_MVP_CLIENTS_BYPASS = 'true';
    const { canDeleteClients } = await import('./clients-access');
    expect(canDeleteClients(ctx({ role: 'org_viewer' }))).toBe(false);
    expect(canDeleteClients(ctx({ role: 'org_owner' }))).toBe(true);
  });
});
