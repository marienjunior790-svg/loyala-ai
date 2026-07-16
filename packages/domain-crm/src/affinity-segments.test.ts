import { describe, expect, it } from 'vitest';
import { computeAffinitySegments } from './affinity-segments';

describe('computeAffinitySegments', () => {
  it('returns empty segments for no rows', () => {
    const r = computeAffinitySegments([]);
    expect(r.products).toEqual([]);
    expect(r.categories).toEqual([]);
    expect(r.totalClients).toBe(0);
  });

  it('assigns each client to a single favorite product and counts clients', () => {
    const r = computeAffinitySegments([
      { clientId: 'c1', product: 'Pizza', category: 'Plats', quantity: 3 },
      { clientId: 'c1', product: 'Coca', category: 'Boissons', quantity: 1 },
      { clientId: 'c2', product: 'Pizza', category: 'Plats', quantity: 2 },
      { clientId: 'c3', product: 'Burger', category: 'Plats', quantity: 5 },
    ]);
    expect(r.totalClients).toBe(3);
    expect(r.products[0]).toEqual({ name: 'Pizza', clientCount: 2 });
    expect(r.products.find((p) => p.name === 'Burger')?.clientCount).toBe(1);
    // Plats is the favorite category for all three clients
    expect(r.categories[0]).toEqual({ name: 'Plats', clientCount: 3 });
  });

  it('ignores zero/negative quantities', () => {
    const r = computeAffinitySegments([
      { clientId: 'c1', product: 'Eau', category: null, quantity: 0 },
    ]);
    expect(r.totalClients).toBe(0);
    expect(r.products).toEqual([]);
  });

  it('breaks quantity ties alphabetically for determinism', () => {
    const r = computeAffinitySegments([
      { clientId: 'c1', product: 'Zeste', category: null, quantity: 2 },
      { clientId: 'c1', product: 'Ananas', category: null, quantity: 2 },
    ]);
    expect(r.products[0]).toEqual({ name: 'Ananas', clientCount: 1 });
  });

  it('respects the limit', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      clientId: `c${i}`,
      product: `P${i}`,
      category: null,
      quantity: 1,
    }));
    const r = computeAffinitySegments(rows, 5);
    expect(r.products).toHaveLength(5);
  });
});
