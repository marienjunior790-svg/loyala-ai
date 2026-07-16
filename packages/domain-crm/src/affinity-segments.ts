import type { SupabaseClient } from '@supabase/supabase-js';

export interface AffinityCount {
  name: string;
  clientCount: number;
}

export interface AffinitySegments {
  products: AffinityCount[];
  categories: AffinityCount[];
  totalClients: number;
}

interface AffinityRow {
  clientId: string;
  product: string;
  category: string | null;
  quantity: number;
}

/** Deterministic top-key by summed quantity (ties broken alphabetically). */
function favoriteKey(totals: Map<string, number>): string | null {
  let best: { name: string; qty: number } | null = null;
  for (const [name, qty] of totals) {
    if (!best || qty > best.qty || (qty === best.qty && name < best.name)) {
      best = { name, qty };
    }
  }
  return best?.name ?? null;
}

function rankCounts(counts: Map<string, number>, limit: number): AffinityCount[] {
  return [...counts.entries()]
    .map(([name, clientCount]) => ({ name, clientCount }))
    .sort((a, b) => b.clientCount - a.clientCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Pure aggregation: each client is assigned to their single favorite product
 * and favorite category (by total purchased quantity), then clients are counted
 * per favorite. Sector-agnostic.
 */
export function computeAffinitySegments(rows: AffinityRow[], limit = 8): AffinitySegments {
  const productTotalsByClient = new Map<string, Map<string, number>>();
  const categoryTotalsByClient = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;

    const p = productTotalsByClient.get(row.clientId) ?? new Map<string, number>();
    p.set(row.product, (p.get(row.product) ?? 0) + qty);
    productTotalsByClient.set(row.clientId, p);

    if (row.category) {
      const c = categoryTotalsByClient.get(row.clientId) ?? new Map<string, number>();
      c.set(row.category, (c.get(row.category) ?? 0) + qty);
      categoryTotalsByClient.set(row.clientId, c);
    }
  }

  const productCounts = new Map<string, number>();
  for (const totals of productTotalsByClient.values()) {
    const fav = favoriteKey(totals);
    if (fav) productCounts.set(fav, (productCounts.get(fav) ?? 0) + 1);
  }

  const categoryCounts = new Map<string, number>();
  for (const totals of categoryTotalsByClient.values()) {
    const fav = favoriteKey(totals);
    if (fav) categoryCounts.set(fav, (categoryCounts.get(fav) ?? 0) + 1);
  }

  return {
    products: rankCounts(productCounts, limit),
    categories: rankCounts(categoryCounts, limit),
    totalClients: productTotalsByClient.size,
  };
}

function isSchemaGap(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('visit_items') ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  );
}

/**
 * Fetches purchase line items for the org and derives product/category affinity
 * segments. Fails soft to empty when the catalog tables are not present yet.
 */
export async function getAffinitySegments(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 8
): Promise<AffinitySegments> {
  const empty: AffinitySegments = { products: [], categories: [], totalClients: 0 };

  const visitsRes = await supabase
    .from('client_visits')
    .select('id, client_id')
    .eq('organization_id', organizationId)
    .limit(10000);

  if (visitsRes.error) {
    if (isSchemaGap(visitsRes.error.message)) return empty;
    throw new Error(visitsRes.error.message);
  }

  const clientByVisit = new Map<string, string>();
  for (const v of (visitsRes.data ?? []) as { id: string; client_id: string }[]) {
    clientByVisit.set(v.id, v.client_id);
  }
  if (clientByVisit.size === 0) return empty;

  const itemsRes = await supabase
    .from('visit_items')
    .select('visit_id, name, category_name, quantity')
    .eq('organization_id', organizationId)
    .limit(50000);

  if (itemsRes.error) {
    if (isSchemaGap(itemsRes.error.message)) return empty;
    throw new Error(itemsRes.error.message);
  }

  const rows: AffinityRow[] = [];
  for (const it of (itemsRes.data ?? []) as {
    visit_id: string;
    name: string;
    category_name: string | null;
    quantity: number;
  }[]) {
    const clientId = clientByVisit.get(it.visit_id);
    if (!clientId) continue;
    rows.push({
      clientId,
      product: it.name,
      category: it.category_name,
      quantity: Number(it.quantity) || 0,
    });
  }

  return computeAffinitySegments(rows, limit);
}
