import { describe, expect, it } from 'vitest';
import { computeClientSegment, isClientInactive, INACTIVE_DAYS_THRESHOLD } from './segments';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('computeClientSegment', () => {
  it('returns new for recent client without visits', () => {
    expect(
      computeClientSegment({
        visit_count: 0,
        last_visit_at: null,
        created_at: daysAgo(1),
      })
    ).toBe('new');
  });

  it('returns at_risk when never visited and account is old', () => {
    expect(
      computeClientSegment({
        visit_count: 0,
        last_visit_at: null,
        created_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 1),
      })
    ).toBe('at_risk');
  });

  it('returns inactive when last visit exceeds threshold with history', () => {
    expect(
      computeClientSegment({
        visit_count: 5,
        last_visit_at: daysAgo(INACTIVE_DAYS_THRESHOLD),
        created_at: daysAgo(90),
      })
    ).toBe('inactive');
  });

  it('returns regular for recent activity', () => {
    expect(
      computeClientSegment({
        visit_count: 2,
        last_visit_at: daysAgo(7),
        created_at: daysAgo(30),
      })
    ).toBe('regular');
  });

  it('isClientInactive ignores stale DB segment new', () => {
    expect(
      isClientInactive({
        segment: 'new',
        visit_count: 5,
        last_visit_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 5),
        created_at: daysAgo(90),
      })
    ).toBe(true);
  });
});
