/**
 * Cross-tenant RLS integration tests.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY in env.
 * Skipped in CI when secrets are not configured.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const canRun = Boolean(url && serviceKey && anonKey);

describe.skipIf(!canRun)('RLS cross-tenant integration', () => {
  let admin: ReturnType<typeof createClient>;

  let orgA: string;
  let orgB: string;
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;
  let clientAId: string;
  let ownerRoleId: string;

  const testEmailA = `test-a-${Date.now()}@loyala.test`;
  const testEmailB = `test-b-${Date.now()}@loyala.test`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('code', 'org_owner')
      .single();
    ownerRoleId = role!.id;

    const { data: userA } = await admin.auth.admin.createUser({
      email: testEmailA,
      password: testPassword,
      email_confirm: true,
    });
    const { data: userB } = await admin.auth.admin.createUser({
      email: testEmailB,
      password: testPassword,
      email_confirm: true,
    });
    userAId = userA.user!.id;
    userBId = userB.user!.id;

    const { data: oA } = await admin
      .from('organizations')
      .insert({ name: 'Org A Test', slug: `org-a-${Date.now()}` })
      .select()
      .single();
    const { data: oB } = await admin
      .from('organizations')
      .insert({ name: 'Org B Test', slug: `org-b-${Date.now()}` })
      .select()
      .single();
    orgA = oA!.id;
    orgB = oB!.id;

    await admin.from('organization_members').insert([
      { organization_id: orgA, user_id: userAId, role_id: ownerRoleId },
      { organization_id: orgB, user_id: userBId, role_id: ownerRoleId },
    ]);

    const { data: cA } = await admin
      .from('clients')
      .insert({ organization_id: orgA, full_name: 'Client A', phone: `+221${Date.now()}1` })
      .select()
      .single();
    clientAId = cA!.id;

    const anon = createClient(url!, anonKey!);
    const { data: sessionA } = await anon.auth.signInWithPassword({
      email: testEmailA,
      password: testPassword,
    });
    const { data: sessionB } = await anon.auth.signInWithPassword({
      email: testEmailB,
      password: testPassword,
    });
    tokenA = sessionA.session!.access_token;
    tokenB = sessionB.session!.access_token;
  }, 60000);

  afterAll(async () => {
    if (!canRun) return;
    await admin.from('clients').delete().in('organization_id', [orgA, orgB]);
    await admin.from('organization_members').delete().in('organization_id', [orgA, orgB]);
    await admin.from('organizations').delete().in('id', [orgA, orgB]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  }, 60000);

  it('user A sees only org A clients', async () => {
    const clientA = createClient(url!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
    });
    const { data, error } = await clientA.from('clients').select('id, organization_id');
    expect(error).toBeNull();
    expect(data?.every((c) => c.organization_id === orgA)).toBe(true);
  });

  it('user B cannot read org A client by id', async () => {
    const clientB = createClient(url!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${tokenB}` } },
    });
    const { data } = await clientB
      .from('clients')
      .select('id')
      .eq('id', clientAId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it('user B cannot list org A clients', async () => {
    const clientB = createClient(url!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${tokenB}` } },
    });
    const { data } = await clientB.from('clients').select('id').eq('organization_id', orgA);
    expect(data ?? []).toHaveLength(0);
  });
});
