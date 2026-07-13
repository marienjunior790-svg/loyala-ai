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
  it('increments visit_count for kind visit only', () => {
    const agg = computeClientAggregatesFromVisits([
      { kind: 'visit', visited_at: daysAgo(1), amount: 5000 },
      { kind: 'visit', visited_at: daysAgo(3), amount: null },
      { kind: 'expense', visited_at: daysAgo(2), amount: 10000 },
    ]);
    expect(agg.visit_count).toBe(2);
    expect(agg.total_spent).toBe(15000);
    expect(agg.last_visit_at).toBeTruthy();
    expect(new Date(agg.last_visit_at!).getTime()).toBeGreaterThan(
      new Date(daysAgo(2)).getTime()
    );
  });

  it('returns zeros when no visits', () => {
    expect(computeClientAggregatesFromVisits([])).toEqual({
      visit_count: 0,
      last_visit_at: null,
      total_spent: 0,
    });
  });

  it('sums amounts from visits and expenses', () => {
    const agg = computeClientAggregatesFromVisits([
      { kind: 'expense', visited_at: daysAgo(0), amount: 25000 },
    ]);
    expect(agg.visit_count).toBe(0);
    expect(agg.total_spent).toBe(25000);
    expect(agg.last_visit_at).toBeNull();
  });
});

describe('segment integration after visit capture', () => {
  it('promotes client to vip after high spend and recent visit', () => {
    const agg = computeClientAggregatesFromVisits([
      { kind: 'visit', visited_at: daysAgo(2), amount: 600_000 },
    ]);
    expect(segmentAfterVisit(agg)).toBe('vip');
    expect(computeClientSegment(agg)).toBe('vip');
  });

  it('marks inactive after old last visit', () => {
    const agg = computeClientAggregatesFromVisits([
      { kind: 'visit', visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 5), amount: 10000 },
      { kind: 'visit', visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 3), amount: 5000 },
      { kind: 'visit', visited_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 1), amount: 5000 },
    ]);
    expect(computeClientSegment(agg)).toBe('inactive');
  });

  it('dashboard revenue reflects total_spent aggregate', () => {
    const clients = [
      computeClientAggregatesFromVisits([
        { kind: 'visit', visited_at: daysAgo(1), amount: 120_000 },
      ]),
      computeClientAggregatesFromVisits([
        { kind: 'visit', visited_at: daysAgo(2), amount: 80_000 },
      ]),
    ];
    const revenue = clients.reduce((sum, c) => sum + c.total_spent, 0);
    expect(revenue).toBe(200_000);
  });
});
