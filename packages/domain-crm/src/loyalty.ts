import type { SupabaseClient } from '@supabase/supabase-js';

export interface LoyaltyTransaction {
  id: string;
  organization_id: string;
  client_id: string;
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

export async function addLoyaltyPoints(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    clientId: string;
    pointsDelta: number;
    reason: string;
    createdBy: string;
  }
): Promise<{ newBalance: number }> {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('loyalty_points')
    .eq('id', input.clientId)
    .eq('organization_id', organizationId)
    .single();

  if (clientError) throw new Error(clientError.message);

  const newBalance = Number(client.loyalty_points ?? 0) + input.pointsDelta;

  const { error: updateError } = await supabase
    .from('clients')
    .update({ loyalty_points: newBalance })
    .eq('id', input.clientId)
    .eq('organization_id', organizationId);

  if (updateError) throw new Error(updateError.message);

  const { error: txError } = await supabase.from('loyalty_transactions').insert({
    organization_id: organizationId,
    client_id: input.clientId,
    points_delta: input.pointsDelta,
    reason: input.reason,
    created_by: input.createdBy,
  });

  if (txError) throw new Error(txError.message);

  return { newBalance };
}

export async function getLoyaltySummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ totalPoints: number; clientsWithPoints: number; topClients: { full_name: string; loyalty_points: number }[] }> {
  const { data, error } = await supabase
    .from('clients')
    .select('full_name, loyalty_points')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .gt('loyalty_points', 0)
    .order('loyalty_points', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  const clients = data ?? [];
  const totalPoints = clients.reduce((sum, c) => sum + Number(c.loyalty_points ?? 0), 0);

  return {
    totalPoints,
    clientsWithPoints: clients.length,
    topClients: clients.map((c) => ({
      full_name: String(c.full_name),
      loyalty_points: Number(c.loyalty_points),
    })),
  };
}
