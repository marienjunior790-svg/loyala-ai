import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeLoyaltyPointsFromAmount, listLoyaltyTransactions, LOYALTY_XOF_PER_POINT } from './loyalty';

type LoyaltyCall = {
  table: string;
  select?: string;
  eq?: [string, string];
  order?: [string, { ascending: boolean }];
  limit?: number;
};

function loyaltySupabase(result: { data: unknown; error: { message: string } | null }, calls: LoyaltyCall[]) {
  const chain = {
    select(value: string) {
      calls[calls.length - 1]!.select = value;
      return chain;
    },
    eq(column: string, value: string) {
      calls[calls.length - 1]!.eq = [column, value];
      return chain;
    },
    order(column: string, options: { ascending: boolean }) {
      calls[calls.length - 1]!.order = [column, options];
      return chain;
    },
    limit(value: number) {
      calls[calls.length - 1]!.limit = value;
      return Promise.resolve(result);
    },
  };
  return {
    from(table: string) {
      calls.push({ table });
      return chain;
    },
  } as unknown as SupabaseClient;
}

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

describe('listLoyaltyTransactions', () => {
  it('cible la clé composite et conserve organisation, tri et limite', async () => {
    const calls: LoyaltyCall[] = [];
    const supabase = loyaltySupabase(
      {
        data: [
          {
            id: 'tx-1',
            organization_id: 'org-a',
            client_id: 'client-1',
            points_delta: 4,
            reason: 'Visite',
            created_at: '2026-10-01T00:00:00.000Z',
            clients: { full_name: 'Awa Ndiaye', loyalty_points: 12 },
          },
        ],
        error: null,
      },
      calls
    );

    const rows = await listLoyaltyTransactions(supabase, 'org-a', 40);

    expect(calls).toEqual([
      {
        table: 'loyalty_transactions',
        select: '*, clients!loyalty_transactions_client_same_org_fkey(full_name, loyalty_points)',
        eq: ['organization_id', 'org-a'],
        order: ['created_at', { ascending: false }],
        limit: 40,
      },
    ]);
    expect(rows[0]?.clients).toEqual({ full_name: 'Awa Ndiaye', loyalty_points: 12 });
  });

  it('utilise la limite de 30 lorsqu’elle n’est pas précisée', async () => {
    const calls: LoyaltyCall[] = [];
    const supabase = loyaltySupabase({ data: [], error: null }, calls);
    await listLoyaltyTransactions(supabase, 'org-a');
    expect(calls[0]?.limit).toBe(30);
  });

  it('retourne une liste vide sans transaction', async () => {
    const calls: LoyaltyCall[] = [];
    const supabase = loyaltySupabase({ data: null, error: null }, calls);
    await expect(listLoyaltyTransactions(supabase, 'org-a')).resolves.toEqual([]);
  });

  it('conserve une transaction dont le client embarqué est inexploitable', async () => {
    const calls: LoyaltyCall[] = [];
    const row = {
      id: 'tx-2',
      organization_id: 'org-a',
      client_id: 'client-absent',
      points_delta: 1,
      reason: 'Manuel',
      created_at: '2026-10-02T00:00:00.000Z',
      clients: null,
    };
    const supabase = loyaltySupabase({ data: [row], error: null }, calls);
    await expect(listLoyaltyTransactions(supabase, 'org-a')).resolves.toEqual([row]);
  });

  it('filtre chaque appel sur l’organisation demandée', async () => {
    const calls: LoyaltyCall[] = [];
    const supabase = loyaltySupabase({ data: [], error: null }, calls);
    await listLoyaltyTransactions(supabase, 'org-a');
    await listLoyaltyTransactions(supabase, 'org-b', 5);
    expect(calls.map((call) => call.eq)).toEqual([
      ['organization_id', 'org-a'],
      ['organization_id', 'org-b'],
    ]);
  });
});
