/**
 * P2.3 — Part livraison depuis order_type (jamais forcée à 0 %).
 */
import { describe, expect, it } from 'vitest';
import {
  computeClientDashboard,
  computeDeliveryChannelMix,
  type DashboardClient,
  type DashboardVisit,
} from './client-dashboard';

const NOW = new Date('2026-10-14T12:00:00Z');

function client(id: string): DashboardClient {
  return {
    id,
    full_name: `Client ${id}`,
    phone: `+2217000000${id}`,
    created_at: '2026-01-10T10:00:00Z',
    total_spent: 50_000,
    visit_count: 3,
    last_visit_at: '2026-10-13T12:00:00Z',
  };
}

function visit(
  id: string,
  amount: number,
  day: string,
  orderType?: string | null
): DashboardVisit {
  return {
    id,
    client_id: 'a',
    visited_at: `${day}T12:00:00Z`,
    amount,
    status: 'paid',
    refunded_amount: 0,
    order_type: orderType,
  };
}

describe('computeDeliveryChannelMix P2.3', () => {
  const range = { start: '2026-10-01', end: '2026-10-14' };

  it('calcule part livraison = CA livraison / CA période', () => {
    const mix = computeDeliveryChannelMix(
      [
        { day: '2026-10-10', amount: 40_000, orderType: 'livraison' },
        { day: '2026-10-11', amount: 60_000, orderType: 'sur_place' },
      ],
      range
    );
    expect(mix.deliverySharePct).toBe(40);
    expect(mix.deliveryRevenue).toBe(40_000);
    expect(mix.periodRevenue).toBe(100_000);
    expect(mix.coveragePct).toBe(100);
  });

  it('ne force pas 0 % si aucun order_type', () => {
    const mix = computeDeliveryChannelMix(
      [
        { day: '2026-10-10', amount: 50_000, orderType: null },
        { day: '2026-10-11', amount: 50_000, orderType: null },
      ],
      range
    );
    expect(mix.deliverySharePct).toBeNull();
    expect(mix.periodRevenue).toBe(100_000);
    expect(mix.limitations.join(' ')).toMatch(/order_type/i);
  });

  it('CA période 0 → deliverySharePct null (pas 0 inventé)', () => {
    const mix = computeDeliveryChannelMix([], range);
    expect(mix.deliverySharePct).toBeNull();
    expect(mix.periodRevenue).toBe(0);
  });

  it('untyped au dénominateur : part sous-estimée possible, jamais inventée', () => {
    const mix = computeDeliveryChannelMix(
      [
        { day: '2026-10-10', amount: 30_000, orderType: 'livraison' },
        { day: '2026-10-11', amount: 70_000, orderType: null },
      ],
      range
    );
    expect(mix.deliverySharePct).toBe(30);
    expect(mix.untypedRevenue).toBe(70_000);
    expect(mix.limitations.join(' ')).toMatch(/sous-estimée/i);
  });
});

describe('computeClientDashboard channelMix P2.3', () => {
  it('expose channelMix avec order_type livraison dominante', () => {
    const dash = computeClientDashboard({
      clients: [client('a')],
      visits: [
        visit('v1', 45_000, '2026-10-10', 'livraison'),
        visit('v2', 45_000, '2026-10-11', 'livraison'),
        visit('v3', 10_000, '2026-10-12', 'sur_place'),
      ],
      items: [],
      period: 'mois',
      now: NOW,
      timezone: 'Africa/Dakar',
    });
    expect(dash.channelMix.deliverySharePct).toBe(90);
    expect(dash.channelMix.deliveryRevenue).toBe(90_000);
  });

  it('sans order_type : deliverySharePct null sur le dashboard', () => {
    const dash = computeClientDashboard({
      clients: [client('a')],
      visits: [visit('v1', 20_000, '2026-10-10'), visit('v2', 20_000, '2026-10-11')],
      items: [],
      period: 'mois',
      now: NOW,
      timezone: 'Africa/Dakar',
    });
    expect(dash.channelMix.deliverySharePct).toBeNull();
  });
});
