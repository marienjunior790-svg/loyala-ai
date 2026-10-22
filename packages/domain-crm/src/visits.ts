import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CancelOrderInput,
  RecordVisitInput,
  RefundOrderInput,
  UpdateVisitInput,
  VisitItemInput,
} from '@loyala/validation';
import { computeClientSegment, type ClientSegment } from './segments';
import type { Client } from './clients';
import {
  countsAsRevenue,
  orderNetAmount,
  type ExternalOrderIdentity,
  type OrderSource,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
} from './orders';
import { orderRpcLacksIdempotency } from './staff-sale';

/** Depuis la migration 040, toutes les commandes ont kind = 'visit' ; legacy_kind garde l'origine. */
export type ClientVisitKind = 'visit' | 'expense';

/** Une commande client (table client_visits). */
export interface ClientVisit {
  id: string;
  organization_id: string;
  client_id: string;
  kind: ClientVisitKind;
  legacy_kind: ClientVisitKind | null;
  visited_at: string;
  amount: number | null;
  subtotal: number;
  discount_amount: number;
  refunded_amount: number;
  status: OrderStatus;
  source: OrderSource;
  order_type: OrderType;
  payment_method: PaymentMethod | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refunded_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Présents après la migration 044. Null pour une saisie manuelle ou une ligne antérieure. */
  external_system?: string | null;
  external_order_id?: string | null;
  external_currency?: string | null;
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

export type OrderIdempotencyOutcome = 'created' | 'duplicate' | 'conflict' | 'rejected';

export interface OrderOperationResult {
  order: ClientVisit;
  /** Points ajoutés (positif) ou retirés (négatif) par l'opération. */
  pointsDelta: number;
  /** Absent tant que la base n'a pas la migration 044. */
  outcome?: OrderIdempotencyOutcome;
  conflictCodes?: string[];
  /**
   * `applied` seulement si la réponse porte le contrat 044.
   * `unavailable` : la base a encore l'ancienne signature, la clé n'a pas été enregistrée.
   */
  idempotency?: 'applied' | 'unavailable';
}

/** Résultat d'un enregistrement qui porte une identité externe. */
export interface ExternalOrderRecordResult {
  order: ClientVisit | null;
  pointsDelta: number;
  outcome: OrderIdempotencyOutcome;
  conflictCodes: string[];
  idempotency?: 'applied' | 'unavailable';
}

/** Pure helper — total from line items. */
export function computeVisitItemsTotal(items: Pick<VisitItemInput, 'quantity' | 'unitPrice'>[]): number {
  return items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
}

export interface ClientVisitAggregates {
  visit_count: number;
  last_visit_at: string | null;
  total_spent: number;
}

/** Mêmes règles que refresh_client_aggregates : commandes payées, montant net. */
export function computeClientAggregatesFromVisits(
  visits: (Pick<ClientVisit, 'visited_at' | 'amount'> & Partial<Pick<ClientVisit, 'status' | 'refunded_amount'>>)[]
): ClientVisitAggregates {
  const counted = visits.filter((v) => countsAsRevenue(v));
  let last_visit_at: string | null = null;
  for (const row of counted) {
    if (!last_visit_at || new Date(row.visited_at) > new Date(last_visit_at)) {
      last_visit_at = row.visited_at;
    }
  }
  return {
    visit_count: counted.length,
    last_visit_at,
    total_spent: counted.reduce((sum, row) => sum + orderNetAmount(row), 0),
  };
}

function parseVisitedAt(isoOrDate: string): string {
  if (isoOrDate.includes('T')) return new Date(isoOrDate).toISOString();
  return new Date(`${isoOrDate}T12:00:00`).toISOString();
}

function toRpcItems(items: VisitItemInput[] | undefined) {
  if (!items || items.length === 0) return null;
  return items.map((i) => ({
    catalog_item_id: i.catalogItemId || null,
    name: i.name.trim(),
    category_name: i.categoryName?.trim() || null,
    item_type: i.itemType ?? null,
    quantity: Number(i.quantity),
    unit_price: Number(i.unitPrice),
    option_selections: i.optionSelections ?? {},
    option_quantities: i.optionQuantities ?? {},
  }));
}

function orderRpcArgs(
  organizationId: string,
  input: RecordVisitInput,
  external?: ExternalOrderIdentity
) {
  const items = toRpcItems(input.items);
  return {
    p_organization_id: organizationId,
    p_client_id: input.clientId,
    p_ordered_at: parseVisitedAt(input.visitedAt),
    p_order_type: input.orderType,
    p_payment_method: input.paymentMethod,
    p_items: items,
    p_amount: items ? null : input.amount ?? null,
    p_discount: input.discount ?? 0,
    p_notes: input.notes?.trim() || null,
    ...(external
      ? {
          p_external_system: external.system,
          p_external_order_id: external.orderId,
          p_currency: external.currency ?? null,
          p_reported_status: external.reportedStatus ?? null,
        }
      : {}),
  };
}

function toExternalOrderResult(data: unknown): ExternalOrderRecordResult {
  const result = data as {
    order?: ClientVisit | null;
    points_delta?: number;
    outcome?: OrderIdempotencyOutcome;
    conflict_codes?: string[];
  };
  return {
    order: result.order ?? null,
    pointsDelta: Number(result.points_delta ?? 0),
    outcome: result.outcome ?? 'created',
    conflictCodes: result.conflict_codes ?? [],
  };
}

function toOperationResult(data: unknown): OrderOperationResult {
  const result = toExternalOrderResult(data);
  return {
    order: result.order as ClientVisit,
    pointsDelta: result.pointsDelta,
    outcome: result.outcome,
    conflictCodes: result.conflictCodes,
  };
}

/** Le segment reste calculé côté application : on le réaligne après chaque opération. */
async function syncClientSegment(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<ClientVisitAggregates> {
  const { data, error } = await supabase
    .from('clients')
    .select('visit_count, last_visit_at, total_spent, segment')
    .eq('id', clientId)
    .eq('organization_id', organizationId)
    .single();
  if (error) throw new Error(error.message);

  const aggregates: ClientVisitAggregates = {
    visit_count: Number(data.visit_count ?? 0),
    last_visit_at: data.last_visit_at ?? null,
    total_spent: Number(data.total_spent ?? 0),
  };
  const segment = computeClientSegment(aggregates);
  if (segment !== data.segment) {
    const { error: updateError } = await supabase
      .from('clients')
      .update({ segment })
      .eq('id', clientId)
      .eq('organization_id', organizationId);
    if (updateError) throw new Error(updateError.message);
  }
  return aggregates;
}

/** Recalcule totaux (en base, à partir des commandes payées) puis segment. */
export async function recalculateClientAggregates(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<ClientVisitAggregates> {
  const { error } = await supabase.rpc('refresh_client_aggregates', { p_client_id: clientId });
  if (error) throw new Error(error.message);
  return syncClientSegment(supabase, organizationId, clientId);
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

/** Enregistre une commande payée en une transaction : lignes, remise, points, totaux, historique. */
export async function recordClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: RecordVisitInput
): Promise<OrderOperationResult>;
/** Même moteur, avec une clé externe. Une répétition ne crée pas une seconde commande. */
export async function recordClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: RecordVisitInput,
  external: ExternalOrderIdentity
): Promise<ExternalOrderRecordResult>;
export async function recordClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: RecordVisitInput,
  external?: ExternalOrderIdentity
): Promise<OrderOperationResult | ExternalOrderRecordResult> {
  let idempotency: 'applied' | 'unavailable' | undefined;
  let { data, error } = await supabase.rpc(
    'record_client_order',
    orderRpcArgs(organizationId, input, external)
  );
  // Sans la migration 044, la signature à 14 arguments est absente.
  // Le second appel crée la commande, sans pouvoir reconnaître une répétition.
  if (error && external && orderRpcLacksIdempotency(error.message)) {
    idempotency = 'unavailable';
    ({ data, error } = await supabase.rpc('record_client_order', orderRpcArgs(organizationId, input)));
  }
  if (error) throw new Error(error.message);

  const raw = data as { outcome?: string } | null;
  if (external && idempotency !== 'unavailable') {
    idempotency = typeof raw?.outcome === 'string' ? 'applied' : 'unavailable';
  }

  if (!external) {
    await syncClientSegment(supabase, organizationId, input.clientId);
    return { ...toOperationResult(data), idempotency };
  }
  const recorded = toExternalOrderResult(data);
  if (recorded.order) {
    await syncClientSegment(supabase, organizationId, recorded.order.client_id);
  }
  return { ...recorded, idempotency };
}

/** Modifie date, type, paiement, remise, note — et le montant seulement pour une commande sans lignes. */
export async function updateClientVisit(
  supabase: SupabaseClient,
  organizationId: string,
  input: UpdateVisitInput
): Promise<OrderOperationResult> {
  const { data, error } = await supabase.rpc('update_client_order', {
    p_organization_id: organizationId,
    p_order_id: input.visitId,
    p_ordered_at: parseVisitedAt(input.visitedAt),
    p_order_type: input.orderType ?? null,
    p_payment_method: input.paymentMethod ?? null,
    p_items: null,
    p_amount: input.amount ?? null,
    p_discount: input.discount ?? null,
    p_notes: input.notes ?? '',
  });
  if (error) throw new Error(error.message);
  await syncClientSegment(supabase, organizationId, input.clientId);
  return toOperationResult(data);
}

/** Annule une commande avec un motif : elle reste dans l'historique, ses points sont retirés. */
export async function cancelClientOrder(
  supabase: SupabaseClient,
  organizationId: string,
  input: CancelOrderInput
): Promise<OrderOperationResult> {
  const { data, error } = await supabase.rpc('cancel_client_order', {
    p_organization_id: organizationId,
    p_order_id: input.visitId,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  await syncClientSegment(supabase, organizationId, input.clientId);
  return toOperationResult(data);
}

export async function refundClientOrder(
  supabase: SupabaseClient,
  organizationId: string,
  input: RefundOrderInput
): Promise<OrderOperationResult> {
  const { data, error } = await supabase.rpc('refund_client_order', {
    p_organization_id: organizationId,
    p_order_id: input.visitId,
    p_amount: input.amount,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  await syncClientSegment(supabase, organizationId, input.clientId);
  return toOperationResult(data);
}

export function segmentAfterVisit(client: Pick<Client, 'visit_count' | 'last_visit_at' | 'total_spent'>): ClientSegment {
  return computeClientSegment(client);
}

export interface ClientOrderEvent {
  id: string;
  order_id: string;
  event: 'migrated' | 'created' | 'updated' | 'cancelled' | 'refunded';
  status_after: OrderStatus;
  amount_after: number | null;
  reason: string | null;
  changes: Record<string, { avant: unknown; apres: unknown }>;
  actor_id: string | null;
  created_at: string;
}

/** Historique daté des commandes d'un client (création, modification, annulation, remboursement). */
export async function listOrderEvents(
  supabase: SupabaseClient,
  organizationId: string,
  orderIds: string[]
): Promise<Map<string, ClientOrderEvent[]>> {
  const map = new Map<string, ClientOrderEvent[]>();
  if (orderIds.length === 0) return map;
  const { data, error } = await supabase
    .from('client_order_events')
    .select('id, order_id, event, status_after, amount_after, reason, changes, actor_id, created_at')
    .eq('organization_id', organizationId)
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as ClientOrderEvent[]) {
    const list = map.get(row.order_id) ?? [];
    list.push(row);
    map.set(row.order_id, list);
  }
  return map;
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

/** Batch purchase history for several clients (2 queries total). */
export async function listClientsPurchases(
  supabase: SupabaseClient,
  organizationId: string,
  clientIds: string[]
): Promise<Map<string, ClientVisitWithItems[]>> {
  const result = new Map<string, ClientVisitWithItems[]>();
  if (clientIds.length === 0) return result;

  const { data, error } = await supabase
    .from('client_visits')
    .select('*')
    .eq('organization_id', organizationId)
    .in('client_id', clientIds)
    .order('visited_at', { ascending: false });

  if (error) throw new Error(error.message);

  const visits = (data ?? []) as ClientVisit[];
  const itemsByVisit = await listVisitItemsByVisitIds(
    supabase,
    organizationId,
    visits.map((v) => v.id)
  );

  for (const v of visits) {
    const list = result.get(v.client_id) ?? [];
    list.push({ ...v, items: itemsByVisit.get(v.id) ?? [] });
    result.set(v.client_id, list);
  }
  return result;
}
