import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const migrationsDir = join(__dirname, '../../../supabase/migrations');

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), 'utf-8');
}

describe('BUG-003 RLS organization_members (037)', () => {
  const sql = readMigration('037_harden_organization_members_rls.sql');

  it('drops permissive insert/update policies before recreating', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS members_insert');
    expect(sql).toContain('DROP POLICY IF EXISTS members_update');
  });

  it('keeps non-recursive SELECT on own user_id', () => {
    expect(sql).toMatch(/members_select[\s\S]*user_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(
      /members_select[\s\S]*organization_id IN \(SELECT[\s\S]*FROM organization_members/
    );
  });

  it('denies authenticated INSERT (no self-join)', () => {
    expect(sql).toMatch(/members_insert[\s\S]*WITH CHECK \(false\)/);
  });

  it('denies authenticated UPDATE (no role / org escalation)', () => {
    expect(sql).toMatch(/members_update[\s\S]*USING \(false\)/);
    expect(sql).toMatch(/members_update[\s\S]*WITH CHECK \(false\)/);
  });

  it('denies authenticated DELETE', () => {
    expect(sql).toMatch(/members_delete[\s\S]*USING \(false\)/);
  });

  it('revokes INSERT/UPDATE/DELETE from authenticated', () => {
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM authenticated'
    );
  });

  it('preserves complete_onboarding execute for authenticated', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.complete_onboarding');
  });
});

describe('BUG-003 expected denial matrix (policy contract)', () => {
  /** Documents the intended outcomes of 037 for integration/manual SQL suites. */
  const matrix = [
    { id: 'A', case: 'SELECT own membership', expect: 'ALLOW' },
    { id: 'B', case: 'SELECT other org membership', expect: 'DENY' },
    { id: 'C', case: 'INSERT self into arbitrary org', expect: 'DENY' },
    { id: 'D', case: 'UPDATE own role_id viewer→owner', expect: 'DENY' },
    { id: 'E', case: 'UPDATE own organization_id', expect: 'DENY' },
    { id: 'F', case: 'UPDATE another user membership', expect: 'DENY' },
    { id: 'G', case: 'INSERT into ORG_B while member of ORG_A', expect: 'DENY' },
  ] as const;

  it('defines deny for escalate / cross-tenant mutations', () => {
    const denies = matrix.filter((m) => m.expect === 'DENY');
    expect(denies.map((d) => d.id).sort().join('')).toBe('BCDEFG');
    expect(matrix.find((m) => m.id === 'A')?.expect).toBe('ALLOW');
  });
});
