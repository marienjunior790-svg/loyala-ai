import type { SupabaseClient } from '@supabase/supabase-js';

/** 1 point per this many XOF spent — same rule as sync_order_loyalty (migration 040). */
export const LOYALTY_XOF_PER_POINT = 1_000;

/** Convert a spend amount (XOF) into loyalty points. */
export function computeLoyaltyPointsFromAmount(amountXof: number | null | undefined): number {
  const amount = Number(amountXof ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / LOYALTY_XOF_PER_POINT);
}

export type LoyaltyTransactionKind = 'earn' | 'reverse' | 'adjust' | 'manual' | 'historique';

export interface LoyaltyTransaction {
  id: string;
  organization_id: string;
  client_id: string;
  visit_id: string | null;
  kind: LoyaltyTransactionKind;
  points_delta: number;
  reason: string;
  created_at: string;
  clients?: { full_name: string; loyalty_points: number } | null;
}

export async function listLoyaltyTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 30
): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*, clients(full_name, loyalty_points)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as LoyaltyTransaction[];
}

/** Ajustement manuel atomique (solde + mouvement daté dans la même transaction). */
export async function addLoyaltyPoints(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    clientId: string;
    pointsDelta: number;
    reason: string;
  }
): Promise<{ newBalance: number }> {
  const { data, error } = await supabase.rpc('adjust_loyalty_points', {
    p_organization_id: organizationId,
    p_client_id: input.clientId,
    p_delta: input.pointsDelta,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { newBalance: Number(data ?? 0) };
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export async function getLoyaltySummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  totalPoints: number;
  clientsWithPoints: number;
  topClients: { full_name: string; loyalty_points: number }[];
}> {
  const holders: { full_name: string; loyalty_points: number }[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('clients')
      .select('full_name, loyalty_points')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gt('loyalty_points', 0)
      .order('loyalty_points', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      holders.push({ full_name: String(row.full_name), loyalty_points: Number(row.loyalty_points) });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  return {
    totalPoints: holders.reduce((sum, c) => sum + c.loyalty_points, 0),
    clientsWithPoints: holders.length,
    topClients: holders.slice(0, 10),
  };
}
