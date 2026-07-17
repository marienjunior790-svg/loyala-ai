import { describe, expect, it } from 'vitest';
import { computeClientPurchaseInsights, isAffinityEligible } from './purchase-insights';
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

describe('isAffinityEligible', () => {
  const now = new Date('2026-07-17T00:00:00.000Z').getTime();
  const fortyDaysAgo = new Date('2026-06-07T00:00:00.000Z').toISOString();
  const tenDaysAgo = new Date('2026-07-07T00:00:00.000Z').toISOString();
  const fav = { favoriteProduct: { name: 'Pizza', quantity: 5 } };

  it('is eligible when opt-in, phone, dormant and a favorite product exist', () => {
    expect(
      isAffinityEligible(
        { opt_in_whatsapp: true, phone: '+2250700', last_visit_at: fortyDaysAgo },
        fav,
        now
      )
    ).toBe(true);
  });

  it('is eligible when the client never visited', () => {
    expect(
      isAffinityEligible({ opt_in_whatsapp: true, phone: '+2250700', last_visit_at: null }, fav, now)
    ).toBe(true);
  });

  it('rejects clients without WhatsApp opt-in', () => {
    expect(
      isAffinityEligible(
        { opt_in_whatsapp: false, phone: '+2250700', last_visit_at: fortyDaysAgo },
        fav,
        now
      )
    ).toBe(false);
  });

  it('rejects clients without a phone number', () => {
    expect(
      isAffinityEligible(
        { opt_in_whatsapp: true, phone: null, last_visit_at: fortyDaysAgo },
        fav,
        now
      )
    ).toBe(false);
  });

  it('rejects clients seen within the dormant window', () => {
    expect(
      isAffinityEligible(
        { opt_in_whatsapp: true, phone: '+2250700', last_visit_at: tenDaysAgo },
        fav,
        now
      )
    ).toBe(false);
  });

  it('rejects clients without an identifiable favorite product', () => {
    expect(
      isAffinityEligible(
        { opt_in_whatsapp: true, phone: '+2250700', last_visit_at: fortyDaysAgo },
        { favoriteProduct: null },
        now
      )
    ).toBe(false);
  });
});
