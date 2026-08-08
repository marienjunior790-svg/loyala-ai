import { describe, expect, it } from 'vitest';
import { computeLoyaltyPointsFromAmount, LOYALTY_XOF_PER_POINT } from './loyalty';

describe('computeLoyaltyPointsFromAmount', () => {
  it('awards 1 point per 1000 XOF', () => {
    expect(LOYALTY_XOF_PER_POINT).toBe(1000);
    expect(computeLoyaltyPointsFromAmount(2000)).toBe(2);
    expect(computeLoyaltyPointsFromAmount(1999)).toBe(1);
    expect(computeLoyaltyPointsFromAmount(999)).toBe(0);
    expect(computeLoyaltyPointsFromAmount(0)).toBe(0);
    expect(computeLoyaltyPointsFromAmount(null)).toBe(0);
  });
});
