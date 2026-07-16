import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RecordExpenseInput,
  RecordVisitInput,
  UpdateVisitInput,
  VisitItemInput,
} from '@loyala/validation';
import { computeClientSegment, type ClientSegment } from './segments';
import type { Client } from './clients';

export type ClientVisitKind = 'visit' | 'expense';

export interface ClientVisit {
  id: string;
  organization_id: string;
  client_id: string;
  kind: ClientVisitKind;
  visited_at: string;
  amount: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitItem {
  id: string;
  organization_id: string;
  visit_id: string;
  catalog_item_id: string | null;
  name: string;
  category_name: string | null;
  item_type: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface ClientVisitWithItems extends ClientVisit {
  items: VisitItem[];
}

/** Pure helper — total from line items. */
export function computeVisitItemsTotal(items: Pick<VisitItemInput, 'quantity' | 'unitPrice'>[]): number {
  return items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
}

async function insertVisitItems(
  supabase: SupabaseClient,
  organizationId: string,
  visitId: string,
  items: VisitItemInput[]
): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((i) => ({
    organization_id: organizationId,
    visit_id: visitId,
    catalog_item_id: i.catalogItemId || null,
    name: i.name.trim(),
    category_name: i.categoryName?.trim() || null,
    item_type: i.itemType ?? null,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    line_total: Number(i.quantity) * Number(i.unitPrice),
  }));
  const { error } = await supabase.from('visit_items').insert(rows);
  if (error) throw new Error(error.message);
}

export interface ClientVisitAggregates {
  visit_count: number;
  last_visit_at: string | null;
  total_spent: number;
}

/** Pure aggregate recompute from visit rows — used by tests and DB sync. */
export function computeClientAggregatesFromVisits(
  visits: Pick<ClientVisit, 'kind' | 'visited_at' | 'amount'>[]
): ClientVisitAggregates {
  const visitRows = visits.filter((v) => v.kind === 'visit');
  let last_visit_at: string | null = null;

  for (const row of visitRows) {
    if (!last_visit_at || new Date(row.visited_at) > new Date(last_visit_at)) {
      last_visit_at = row.visited_at;
    }
  }

  const total_spent = visits.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return {
    visit_count: visitRows.length,
    last_visit_at,
    total_spent,
  };
}

function parseVisitedAt(isoOrDate: string): string {
  if (isoOrDate.includes('T')) return new Date(isoOrDate).toISOString();
  return new Date(`${isoOrDate}T12:00:00`).toISOString();
}

async function loadClientVisitsForAggregate(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<Pick<ClientVisit, 'kind' | 'visited_at' | 'amount'>[]> {
  const { data, error } = await supabase
    .from('client_visits')
    .select('kind, visited_at, amount')
    .eq('organization_id', organizationId)
    .eq('client_id', clientId);

  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<ClientVisit, 'kind' | 'visited_at' | 'amount'>[];
}

export async function recalculateClientAggregates(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<ClientVisitAggregates> {
  const rows = await loadClientVisitsForAggregate(supabase, organizationId, clientId);
  const aggregates = computeClientAggregatesFromVisits(rows);

  const segment = computeClientSegment({
    visit_count: aggregates.visit_count,
    last_visit_at: aggregates.last_visit_at,
    total_spent: aggregates.total_spent,
  });

  const { error } = await supabase
    .from('clients')
    .update({
      visit_count: aggregates.visit_count,
      last_visit_at: aggregates.last_visit_at,
      total_spent: aggregates.total_spent,
      segment,
    })
    .eq('id', clientId)
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
  return aggregates;
}

export async function listClientVisits(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 50
): Promise<ClientVisit[]> {
  const { data, error } = await supabase
    .from('client_visits')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('client_id', clientId)
    .order('visited_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientVisit[];
}

export async function recordClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: RecordVisitInput & { createdBy: string }
): Promise<ClientVisit> {
  const items = input.items ?? [];
  // When line items are provided, the total is derived from them (source of truth).
  const amount = items.length > 0 ? computeVisitItemsTotal(items) : input.amount ?? null;

  const { data, error } = await supabase
    .from('client_visits')
    .insert({
      organization_id: organizationId,
      client_id: input.clientId,
      kind: 'visit',
      visited_at: parseVisitedAt(input.visitedAt),
      amount,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const visit = data as ClientVisit;
  await insertVisitItems(supabase, organizationId, visit.id, items);
  await recalculateClientAggregates(supabase, organizationId, input.clientId);
  return visit;
}

export async function recordClientExpense(
  supabase: SupabaseClient,
  organizationId: string,
  input: RecordExpenseInput & { createdBy: string }
): Promise<ClientVisit> {
  const { data, error } = await supabase
    .from('client_visits')
    .insert({
      organization_id: organizationId,
      client_id: input.clientId,
      kind: 'expense',
      visited_at: parseVisitedAt(input.visitedAt),
      amount: input.amount,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  await recalculateClientAggregates(supabase, organizationId, input.clientId);
  return data as ClientVisit;
}

export async function updateClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: UpdateVisitInput
): Promise<ClientVisit> {
  const payload: Record<string, unknown> = {
    visited_at: parseVisitedAt(input.visitedAt),
    amount: input.amount ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('client_visits')
    .update(payload)
    .eq('id', input.visitId)
    .eq('client_id', input.clientId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await recalculateClientAggregates(supabase, organizationId, input.clientId);
  return data as ClientVisit;
}

export async function deleteClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  visitId: string
): Promise<void> {
  const { error } = await supabase
    .from('client_visits')
    .delete()
    .eq('id', visitId)
    .eq('client_id', clientId)
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
  await recalculateClientAggregates(supabase, organizationId, clientId);
}

export function segmentAfterVisit(client: Pick<Client, 'visit_count' | 'last_visit_at' | 'total_spent'>): ClientSegment {
  return computeClientSegment(client);
}

export async function listVisitItemsByVisitIds(
  supabase: SupabaseClient,
  organizationId: string,
  visitIds: string[]
): Promise<Map<string, VisitItem[]>> {
  const map = new Map<string, VisitItem[]>();
  if (visitIds.length === 0) return map;

  const { data, error } = await supabase
    .from('visit_items')
    .select('*')
    .eq('organization_id', organizationId)
    .in('visit_id', visitIds)
    .order('created_at', { ascending: true });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('visit_items') || msg.includes('does not exist') || msg.includes('schema cache')) {
      return map;
    }
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as VisitItem[]) {
    const list = map.get(row.visit_id) ?? [];
    list.push(row);
    map.set(row.visit_id, list);
  }
  return map;
}

export async function listClientPurchases(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 100
): Promise<ClientVisitWithItems[]> {
  const visits = await listClientVisits(supabase, organizationId, clientId, limit);
  const itemsByVisit = await listVisitItemsByVisitIds(
    supabase,
    organizationId,
    visits.map((v) => v.id)
  );
  return visits.map((v) => ({ ...v, items: itemsByVisit.get(v.id) ?? [] }));
}
