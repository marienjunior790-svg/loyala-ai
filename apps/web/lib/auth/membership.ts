import type { SupabaseClient } from '@supabase/supabase-js';

export type ActiveMembership = { organization_id: string };

/** Resolve the user's active org — RPC first (SECURITY DEFINER), then RLS table fallback. */
export async function getActiveMembership(
  supabase: SupabaseClient
): Promise<ActiveMembership | null> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_my_active_membership');

  if (!rpcError && rpcRows) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row?.organization_id) {
      return { organization_id: row.organization_id as string };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);

  return rows?.[0] ?? null;
}
