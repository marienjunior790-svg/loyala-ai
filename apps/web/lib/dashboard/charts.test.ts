import { describe, expect, it } from 'vitest';
import { bucketVisitsByWeek, toChartThousands } from './charts';

describe('bucketVisitsByWeek', () => {
  const now = Date.parse('2026-08-08T12:00:00.000Z');

  it('counts visits into weekly buckets', () => {
    const points = bucketVisitsByWeek(
      [
        '2026-08-07T10:00:00.000Z', // ~1j → cette semaine
        '2026-07-28T10:00:00.000Z', // ~11j → S-1
        '2026-07-20T10:00:00.000Z', // ~19j → S-2
        '2026-06-01T10:00:00.000Z', // ancien → S-3+
      ],
      now
    );

    expect(points.map((p) => p.value)).toEqual([1, 1, 1, 1]);
  });

  it('returns zeros when empty', () => {
    expect(bucketVisitsByWeek([], now).every((p) => p.value === 0)).toBe(true);
  });
});

describe('toChartThousands', () => {
  it('keeps small non-zero revenue visible', () => {
    expect(toChartThousands(0)).toBe(0);
    expect(toChartThousands(400)).toBe(1);
    expect(toChartThousands(2000)).toBe(2);
  });
});
