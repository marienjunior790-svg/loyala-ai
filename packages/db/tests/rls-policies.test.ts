import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const migrationsDir = join(__dirname, '../../../supabase/migrations');

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), 'utf-8');
}

describe('RLS policies (static)', () => {
  const migration001 = readMigration('001_core_tenant.sql');
  const migration002 = readMigration('002_crm_clients.sql');

  it('enables RLS on organizations', () => {
    expect(migration001).toContain('ALTER TABLE organizations ENABLE ROW LEVEL SECURITY');
  });

  it('enables RLS on clients', () => {
    expect(migration002).toContain('ALTER TABLE clients ENABLE ROW LEVEL SECURITY');
  });

  it('defines auth.user_org_ids helper', () => {
    expect(migration001).toContain('auth.user_org_ids()');
  });

  it('clients policies scope by organization_id', () => {
    expect(migration002).toContain('clients_select');
    expect(migration002).toContain('organization_id IN (SELECT auth.user_org_ids())');
  });

  it('domain_events isolated per tenant', () => {
    expect(migration001).toContain('domain_events_select');
  });

  it('organization_members RLS uses non-recursive policies (010)', () => {
    const migration010 = readMigration('010_fix_organization_members_rls.sql');
    expect(migration010).toContain('members_select');
    expect(migration010).toContain('user_id = auth.uid()');
    expect(migration010).toContain('get_my_active_membership');
  });
});
