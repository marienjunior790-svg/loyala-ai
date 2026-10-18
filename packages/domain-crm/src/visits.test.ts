import { describe, expect, it } from 'vitest';
import {
  computeClientAggregatesFromVisits,
  segmentAfterVisit,
} from './visits';
import { computeClientSegment, INACTIVE_DAYS_THRESHOLD } from './segments';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('computeClientAggregatesFromVisits', () => {
  it('compte toutes les commandes payées, sur place comme à emporter', () => {
    const agg = computeClientAggregatesFromVisits([
      { visited_at: daysAgo(1), amount: 5000, status: 'paid' },
      { visited_at: daysAgo(3), amount: null, status: 'paid' },
      { visited_at: daysAgo(2), amount: 10000, status: 'paid' },
    ]);
    expect(agg.visit_count).toBe(3);
    expect(agg.total_spent).toBe(15000);
    expect(new Date(agg.last_visit_at!).getTime()).toBeGreaterThan(new Date(daysAgo(2)).getTime());
  });

  it('returns zeros when no visits', () => {
    expect(computeClientAggregatesFromVisits([])).toEqual({
      visit_count: 0,
      last_visit_at: null,
      total_spent: 0,
    });
  });

  it('exclut les commandes annulées, en attente ou remboursées et déduit les remboursements partiels', () => {
    const agg = computeClientAggregatesFromVisits([
      { visited_at: '2026-10-14T12:00:00.000Z', amount: 25000, status: 'cancelled' },
      { visited_at: '2026-10-14T12:00:00.000Z', amount: 8000, status: 'pending' },
      { visited_at: '2026-10-14T12:00:00.000Z', amount: 9000, status: 'refunded', refunded_amount: 9000 },
      { visited_at: '2026-10-10T12:00:00.000Z', amount: 10000, status: 'partially_refunded', refunded_amount: 2500 },
    ]);
    expect(agg).toEqual({ visit_count: 1, total_spent: 7500, last_visit_at: '2026-10-10T12:00:00.000Z' });
  });

  it('traite une ligne sans statut (avant migration) comme payée', () => {
    expect(computeClientAggregatesFromVisits([{ visited_at: daysAgo(1), amount: 4000 }]).total_spent).toBe(4000);
  });
});

describe('segment integration after visit capture', () => {
  it('promotes client to vip after high spend and recent visit', () => {
    const agg = computeClientAggregatesFromVisits([
      { visited_at: daysAgo(2), amount: 600_000 },
    ]);
    expect(segmentAfterVisit(agg)).toBe('vip');
    expect(computeClientSegment(agg)).toBe('vip');
  });

  it('marks inactive after old last visit', () => {
    const agg = computeClientAggregatesFromVisits([
      { visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 5), amount: 10000 },
      { visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 3), amount: 5000 },
      { visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 1), amount: 5000 },
    ]);
    expect(computeClientSegment(agg)).toBe('inactive');
  });

  it('dashboard revenue reflects total_spent aggregate', () => {
    const clients = [
      computeClientAggregatesFromVisits([{ visited_at: daysAgo(1), amount: 120_000 }]),
      computeClientAggregatesFromVisits([{ visited_at: daysAgo(2), amount: 80_000 }]),
    ];
    const revenue = clients.reduce((sum, c) => sum + c.total_spent, 0);
    expect(revenue).toBe(200_000);
  });
});
