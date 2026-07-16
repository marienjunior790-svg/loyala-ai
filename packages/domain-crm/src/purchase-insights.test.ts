import { describe, expect, it } from 'vitest';
import { computeClientPurchaseInsights } from './purchase-insights';
import type { ClientVisitWithItems } from './visits';

function visit(
  id: string,
  visitedAt: string,
  amount: number,
  items: Array<{ name: string; category?: string; qty: number; price: number }> = []
): ClientVisitWithItems {
  return {
    id,
    organization_id: 'org',
    client_id: 'client',
    kind: 'visit',
    visited_at: visitedAt,
    amount,
    notes: null,
    created_by: 'user',
    created_at: visitedAt,
    updated_at: visitedAt,
    items: items.map((i, idx) => ({
      id: `${id}-${idx}`,
      organization_id: 'org',
      visit_id: id,
      catalog_item_id: null,
      name: i.name,
      category_name: i.category ?? null,
      item_type: 'product',
      quantity: i.qty,
      unit_price: i.price,
      line_total: i.qty * i.price,
      created_at: visitedAt,
    })),
  };
}

describe('computeClientPurchaseInsights', () => {
  it('returns zeroed insights for no visits', () => {
    const r = computeClientPurchaseInsights([]);
    expect(r.totalSpent).toBe(0);
    expect(r.visitCount).toBe(0);
    expect(r.averageBasket).toBe(0);
    expect(r.favoriteProduct).toBeNull();
    expect(r.isVipCandidate).toBe(false);
  });

  it('computes total, basket and last purchase', () => {
    const r = computeClientPurchaseInsights([
      visit('v1', '2026-01-10T12:00:00.000Z', 5000, [{ name: 'Burger', category: 'Plats', qty: 2, price: 2500 }]),
      visit('v2', '2026-02-10T12:00:00.000Z', 700, [{ name: 'Coca', category: 'Boissons', qty: 1, price: 700 }]),
    ]);
    expect(r.totalSpent).toBe(5700);
    expect(r.purchaseCount).toBe(2);
    expect(r.averageBasket).toBe(2850);
    expect(r.lastPurchaseAt).toBe('2026-02-10T12:00:00.000Z');
  });

  it('detects favorite product and category by quantity', () => {
    const r = computeClientPurchaseInsights([
      visit('v1', '2026-01-10T12:00:00.000Z', 7500, [
        { name: 'Burger', category: 'Plats', qty: 3, price: 2500 },
      ]),
      visit('v2', '2026-01-20T12:00:00.000Z', 1400, [
        { name: 'Coca', category: 'Boissons', qty: 2, price: 700 },
      ]),
    ]);
    expect(r.favoriteProduct?.name).toBe('Burger');
    expect(r.favoriteCategory?.name).toBe('Plats');
  });

  it('flags VIP candidates by spend threshold', () => {
    const r = computeClientPurchaseInsights([
      visit('v1', '2026-01-10T12:00:00.000Z', 250_000),
    ]);
    expect(r.isVipCandidate).toBe(true);
  });

  it('picks the best month by spend', () => {
    const r = computeClientPurchaseInsights([
      visit('v1', '2026-01-10T12:00:00.000Z', 1000),
      visit('v2', '2026-03-10T12:00:00.000Z', 9000),
      visit('v3', '2026-03-20T12:00:00.000Z', 1000),
    ]);
    expect(r.bestMonth?.month).toBe('2026-03');
    expect(r.bestMonth?.total).toBe(10000);
  });
});
