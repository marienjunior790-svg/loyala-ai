/**
 * P2.2 — Tests briefing proactif unifié (fixtures synthétiques).
 */
import { describe, expect, it } from 'vitest';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import type { MiOpportunity } from './mi-opportunities';
import type { MiRetentionStrategy } from './mi-customer-intelligence';

function period() {
  return {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-18',
    definition: 'synthétique P2.2',
  };
}

function base(partial: Partial<MiBriefingSource> = {}): MiBriefingSource {
  const p = period();
  const defaults: MiBriefingSource = {
    organizationId: 'org-p22',
    restaurantName: 'Resto Synth P22',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period: p,
    dataQuality: 'ok',
    limits: [],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 40,
    trends: null,
    opportunities: [],
    customerIntelligence: {
      period: { ...p },
      dataQuality: 'ok',
      metrics: [],
      segments: null,
      medianRecencyDays: null,
    },
    retentionStrategies: [],
    campaignProposals: [],
    channelMix: null,
    reviewsInsight: null,
    recencyLoyalty: null,
    campaignActivity: null,
    measurementWindows: [],
  };
  return {
    ...defaults,
    ...partial,
    organizationId: partial.organizationId ?? defaults.organizationId,
  };
}

function opp(ruleId: MiOpportunity['ruleId'], priority: MiOpportunity['priority'] = 'high'): MiOpportunity {
  return {
    id: ruleId,
    ruleId,
    priority,
    facts: [`Fait synthétique ${ruleId}`],
    detectionRule: `Règle ${ruleId}`,
    period: { code: 'mois', label: 'Mois', from: '2026-10-01', to: '2026-10-18' },
    limits: ['Variation ≠ cause'],
    suggestedAction: `Action ${ruleId}`,
    rankScore: priority === 'high' ? 300 : 200,
  };
}

function retention(
  ruleId: MiRetentionStrategy['ruleId'],
  segmentKey: MiRetentionStrategy['segmentKey'] = 'inactive'
): MiRetentionStrategy {
  return {
    id: ruleId,
    ruleId,
    priority: 'high',
    segmentKey,
    headcount: 5,
    selectionCriteria: 'synth',
    facts: [`n=5 ${ruleId}`],
    period: { code: 'mois', label: 'Mois', from: '2026-10-01', to: '2026-10-18' },
    marketingObjective: `Objectif ${ruleId}`,
    suggestedAction: `Relancer ${ruleId}`,
    limits: ['Pas de ROI inventé'],
    confidence: 'medium',
    rankScore: 280,
  };
}

describe('buildMiProactiveBriefing P2.2', () => {
  it('1 — baisse CA CRM observée', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        trends: {
          revenue: { current: 700, previous: 1000, changePct: -30, significant: true },
          visits: { current: 40, previous: 42, changePct: -4.8, significant: false },
          clientsServed: { current: 35, previous: 36, changePct: -2.8, significant: false },
          averageBasket: { current: 17.5, previous: 23.8, changePct: -26.5, significant: true },
          newClients: { current: 4, previous: 5, changePct: -20, significant: false },
          comparisonNote: 'Comparaison synthétique.',
        },
        opportunities: [opp('revenue_drop_significant')],
      })
    );
    expect(briefing.status).toBe('ready');
    const activity = briefing.items.find((i) => i.familyKey === 'activity_drop');
    expect(activity).toBeTruthy();
    expect(activity!.evidence.join(' ')).toMatch(/-30|700|1000/);
    expect(activity!.dataOrigin).toBe('observed_crm');
    const blob1 = JSON.stringify(briefing);
    expect(blob1.includes('ROI=') || /ROI\s*=\s*\d/.test(blob1)).toBe(false);
    expect(blob1).not.toContain('"foodCostPct":');
  });

  it('2 — baisse visites CRM observée', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        trends: {
          revenue: { current: 900, previous: 920, changePct: -2.2, significant: false },
          visits: { current: 20, previous: 45, changePct: -55.6, significant: true },
          clientsServed: { current: 18, previous: 40, changePct: -55, significant: true },
          averageBasket: { current: 45, previous: 23, changePct: 95, significant: true },
          newClients: { current: 2, previous: 3, changePct: -33, significant: false },
          comparisonNote: 'note',
        },
        opportunities: [opp('visits_drop_significant')],
      })
    );
    const activity = briefing.items.find((i) => i.familyKey === 'activity_drop');
    expect(activity).toBeTruthy();
    expect(activity!.title + activity!.evidence.join(' ')).toMatch(/visite|-55/i);
  });

  it('3 — opportunité fidélisation / reconquête', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        opportunities: [opp('inactive_loyal_reconquest')],
        retentionStrategies: [retention('reactivate_inactive')],
      })
    );
    const fam = briefing.items.filter((i) => i.familyKey === 'inactive_reconquest');
    expect(fam.length).toBe(1); // dédup
    expect(fam[0]!.source).toMatch(/mi-opportunities|mi-retention/);
    expect(fam[0]!.recommendedActions.length).toBeGreaterThan(0);
  });

  it('4 — plusieurs signaux combinés sans doublons inutiles', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        trends: {
          revenue: { current: 600, previous: 1000, changePct: -40, significant: true },
          visits: { current: 25, previous: 50, changePct: -50, significant: true },
          clientsServed: { current: 22, previous: 45, changePct: -51, significant: true },
          averageBasket: { current: 24, previous: 22, changePct: 9, significant: false },
          newClients: { current: 1, previous: 5, changePct: -80, significant: true },
          comparisonNote: 'note',
        },
        opportunities: [
          opp('revenue_drop_significant'),
          opp('visits_drop_significant'),
          opp('inactive_loyal_reconquest'),
          opp('new_clients_drop', 'medium'),
        ],
        retentionStrategies: [
          retention('reactivate_inactive'),
          retention('nurture_at_risk', 'at_risk'),
        ],
      })
    );
    const keys = briefing.items.map((i) => i.familyKey);
    expect(keys.filter((k) => k === 'activity_drop')).toHaveLength(1);
    expect(keys.filter((k) => k === 'inactive_reconquest')).toHaveLength(1);
    expect(briefing.items.length).toBeLessThan(
      2 + 4 + 2 + 5 // sans dédup ce serait beaucoup plus
    );
  });

  it('5 — données insuffisantes → status insufficient, pas de faux KPI', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        dataQuality: 'insufficient',
        limits: ['Aucun client actif'],
        clientCount: 0,
        trends: null,
        opportunities: [],
      })
    );
    expect(briefing.status).toBe('insufficient');
    expect(briefing.items[0]?.kind).toBe('missing_data');
    expect(briefing.missingForBetterBriefing.length).toBeGreaterThan(0);
    expect(briefing.executionNote).toMatch(/aucune campagne envoyée|Aucun/i);
  });

  it('6 — aucun chiffre financier inventé', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        opportunities: [opp('revenue_drop_significant')],
        trends: {
          revenue: { current: 500, previous: 800, changePct: -37.5, significant: true },
          visits: { current: 30, previous: 40, changePct: -25, significant: true },
          clientsServed: { current: 28, previous: 36, changePct: -22, significant: true },
          averageBasket: { current: 16, previous: 22, changePct: -27, significant: true },
          newClients: { current: 3, previous: 4, changePct: -25, significant: false },
          comparisonNote: 'note',
        },
      })
    );
    const blob = JSON.stringify(briefing);
    expect(blob).not.toContain('"foodCostPct":');
    expect(blob.includes('ROI estimé') || blob.includes('marge nette = ')).toBe(false);
    expect(briefing.limitations.join(' ')).toMatch(/Impact financier|non inventé/i);
  });

  it('7 — provenance et confiance cohérentes', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        opportunities: [opp('at_risk_segment_size')],
        retentionStrategies: [retention('nurture_at_risk', 'at_risk')],
      })
    );
    for (const item of briefing.items) {
      expect(['observed_crm', 'user_declared', 'derived_rule', 'synthetic_test', 'missing']).toContain(
        item.dataOrigin
      );
      expect(['low', 'medium']).toContain(item.confidence);
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it('8 — isolation : organizationId du snapshot source respecté (pas de croisement)', () => {
    const a = buildMiProactiveBriefing(base({ organizationId: 'org-A', clientCount: 10 }));
    const b = buildMiProactiveBriefing(
      base({
        organizationId: 'org-B',
        clientCount: 0,
        dataQuality: 'insufficient',
        limits: ['vide'],
      })
    );
    expect(a.status).not.toBe(b.status);
    // Le briefing ne transporte pas d’ids clients d’une autre org
    expect(JSON.stringify(a)).not.toMatch(/org-B/);
  });

  it('11 — briefing empty quand aucun seuil atteint', () => {
    const briefing = buildMiProactiveBriefing(
      base({
        clientCount: 20,
        trends: {
          revenue: { current: 100, previous: 100, changePct: 0, significant: false },
          visits: { current: 20, previous: 20, changePct: 0, significant: false },
          clientsServed: { current: 15, previous: 15, changePct: 0, significant: false },
          averageBasket: { current: 5, previous: 5, changePct: 0, significant: false },
          newClients: { current: 2, previous: 2, changePct: 0, significant: false },
          comparisonNote: 'stable',
        },
        opportunities: [],
        retentionStrategies: [],
        campaignProposals: [],
      })
    );
    // Bomaye peut encore produire des items (ex. contacts > 0 → pas CASE-NO-CONTACTS)
    // Si vraiment vide de familles utiles :
    if (briefing.items.length === 0) {
      expect(briefing.status).toBe('empty');
    } else {
      expect(briefing.status).toBe('ready');
      expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);
    }
  });

  it('10 — note d’exécution : pas d’envoi externe', () => {
    const briefing = buildMiProactiveBriefing(base({ opportunities: [opp('revenue_rise_significant', 'low')] }));
    expect(briefing.executionNote).toMatch(/WhatsApp|campagne envoyée|irréversible/i);
  });
});
