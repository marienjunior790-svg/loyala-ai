import type { SupabaseClient } from '@supabase/supabase-js';
import { listClientsPurchases, type ClientVisitWithItems, type VisitItem } from './visits';

export interface ClientPurchaseInsights {
  totalSpent: number;
  visitCount: number;
  purchaseCount: number;
  averageBasket: number;
  lastPurchaseAt: string | null;
  /** Average purchases per 30 days over the client's active window. */
  purchaseFrequencyPerMonth: number;
  favoriteProduct: { name: string; quantity: number } | null;
  favoriteCategory: { name: string; quantity: number } | null;
  bestMonth: { month: string; total: number } | null;
  isVipCandidate: boolean;
}

const VIP_SPEND_THRESHOLD = 200_000; // XOF
const VIP_VISITS_THRESHOLD = 8;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function topByQuantity(
  counts: Map<string, number>
): { name: string; quantity: number } | null {
  let best: { name: string; quantity: number } | null = null;
  for (const [name, quantity] of counts) {
    if (!best || quantity > best.quantity) best = { name, quantity };
  }
  return best;
}

/**
 * Pure CRM intelligence over a client's purchase history.
 * Sector-agnostic: works for restaurants, hotels, salons, retail, etc.
 */
export function computeClientPurchaseInsights(
  visits: ClientVisitWithItems[]
): ClientPurchaseInsights {
  const sales = visits.filter((v) => v.kind === 'visit');
  const purchasingVisits = sales.filter((v) => Number(v.amount ?? 0) > 0);

  const totalSpent = sales.reduce((sum, v) => sum + Number(v.amount ?? 0), 0);
  const visitCount = sales.length;
  const purchaseCount = purchasingVisits.length;
  const averageBasket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

  let lastPurchaseAt: string | null = null;
  let firstPurchaseAt: string | null = null;
  const productCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const monthTotals = new Map<string, number>();

  const allItems: VisitItem[] = [];
  for (const v of sales) {
    if (!lastPurchaseAt || new Date(v.visited_at) > new Date(lastPurchaseAt)) {
      lastPurchaseAt = v.visited_at;
    }
    if (!firstPurchaseAt || new Date(v.visited_at) < new Date(firstPurchaseAt)) {
      firstPurchaseAt = v.visited_at;
    }
    monthTotals.set(
      monthKey(v.visited_at),
      (monthTotals.get(monthKey(v.visited_at)) ?? 0) + Number(v.amount ?? 0)
    );
    for (const item of v.items) allItems.push(item);
  }

  for (const item of allItems) {
    const qty = Number(item.quantity) || 0;
    productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + qty);
    if (item.category_name) {
      categoryCounts.set(item.category_name, (categoryCounts.get(item.category_name) ?? 0) + qty);
    }
  }

  let bestMonth: { month: string; total: number } | null = null;
  for (const [month, total] of monthTotals) {
    if (!bestMonth || total > bestMonth.total) bestMonth = { month, total };
  }

  let purchaseFrequencyPerMonth = 0;
  if (firstPurchaseAt && lastPurchaseAt && purchaseCount > 0) {
    const spanDays =
      (new Date(lastPurchaseAt).getTime() - new Date(firstPurchaseAt).getTime()) / 86_400_000;
    const months = Math.max(spanDays / 30, 1 / 30);
    purchaseFrequencyPerMonth = purchaseCount / months;
  }

  const isVipCandidate =
    totalSpent >= VIP_SPEND_THRESHOLD || visitCount >= VIP_VISITS_THRESHOLD;

  return {
    totalSpent,
    visitCount,
    purchaseCount,
    averageBasket,
    lastPurchaseAt,
    purchaseFrequencyPerMonth,
    favoriteProduct: topByQuantity(productCounts),
    favoriteCategory: topByQuantity(categoryCounts),
    bestMonth,
    isVipCandidate,
  };
}

export const AFFINITY_DORMANT_DAYS = 30;

/**
 * Eligibility for an affinity re-engagement campaign. Mirrors the worker rules:
 * opt-in WhatsApp + phone + dormant (>= dormantDays or never) + a known favorite product.
 * Pure and deterministic for testing.
 */
export function isAffinityEligible(
  client: { opt_in_whatsapp?: boolean | null; phone?: string | null; last_visit_at?: string | null },
  insights: Pick<ClientPurchaseInsights, 'favoriteProduct'> | undefined,
  now: number = Date.now(),
  dormantDays: number = AFFINITY_DORMANT_DAYS
): boolean {
  if (!client.opt_in_whatsapp) return false;
  if (!client.phone) return false;
  if (!insights?.favoriteProduct?.name) return false;

  if (!client.last_visit_at) return true;
  const daysSinceVisit = (now - new Date(client.last_visit_at).getTime()) / 86_400_000;
  return daysSinceVisit >= dormantDays;
}

/** Fetch + compute purchase insights for several clients at once. */
export async function getClientsPurchaseInsights(
  supabase: SupabaseClient,
  organizationId: string,
  clientIds: string[]
): Promise<Map<string, ClientPurchaseInsights>> {
  const purchases = await listClientsPurchases(supabase, organizationId, clientIds);
  const out = new Map<string, ClientPurchaseInsights>();
  for (const id of clientIds) {
    out.set(id, computeClientPurchaseInsights(purchases.get(id) ?? []));
  }
  return out;
}
