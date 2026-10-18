import { describe, expect, it } from 'vitest';
import {
  applyMiCampaignDraftEdits,
  buildMiCampaignDraftFromProposal,
  buildMiCampaignProposals,
  validateMiCampaignDraft,
} from './mi-campaign-intelligence';
import type { MiPeriodMeta } from './mi-tools';
import type { MiRetentionStrategy } from './mi-customer-intelligence';

const period: MiPeriodMeta = {
  code: 'mois',
  label: 'Mois',
  from: '2026-10-01',
  to: '2026-10-18',
  definition: 'Du 1er…',
};

function retention(
  partial: Partial<MiRetentionStrategy> & Pick<MiRetentionStrategy, 'ruleId' | 'segmentKey' | 'headcount'>
): MiRetentionStrategy {
  return {
    id: partial.ruleId,
    ruleId: partial.ruleId,
    priority: partial.priority ?? 'medium',
    segmentKey: partial.segmentKey,
    headcount: partial.headcount,
    selectionCriteria: partial.selectionCriteria ?? 'critère test',
    facts: partial.facts ?? [`n=${partial.headcount}`],
    period: { code: 'mois', label: 'Mois', from: period.from, to: period.to },
    marketingObjective: partial.marketingObjective ?? 'Objectif test',
    suggestedAction: partial.suggestedAction ?? 'Action',
    limits: partial.limits ?? ['Pas de ROI'],
    confidence: partial.confidence ?? 'medium',
    rankScore: partial.rankScore ?? 200,
  };
}

describe('buildMiCampaignProposals', () => {
  it('vide sans clients', () => {
    expect(
      buildMiCampaignProposals({
        period,
        dataQuality: 'ok',
        restaurantName: 'Chez Test',
        currency: 'XOF',
        retentionStrategies: [],
        topProducts: [],
        topClients: [],
        inactiveLoyal: [],
        segments: null,
        clientCount: 0,
      })
    ).toEqual([]);
  });

  it('mappe retention inactive → proposition campagne avec effectif réel', () => {
    const proposals = buildMiCampaignProposals({
      period,
      dataQuality: 'ok',
      restaurantName: 'Chez Test',
      currency: 'XOF',
      retentionStrategies: [
        retention({
          ruleId: 'reactivate_inactive',
          segmentKey: 'inactive',
          headcount: 4,
          priority: 'high',
        }),
        retention({
          ruleId: 'encourage_second_purchase',
          segmentKey: 'new_period',
          headcount: 2,
          priority: 'low',
        }),
      ],
      topProducts: [],
      topClients: [],
      inactiveLoyal: [],
      segments: { new: 2, regular: 0, vip: 0, inactive: 4, at_risk: 0 },
      clientCount: 10,
    });
    const reactivate = proposals.find((p) => p.objectiveId === 'reactivate_inactive');
    expect(reactivate).toBeDefined();
    expect(reactivate!.audienceHeadcount).toBe(4);
    expect(reactivate!.campaignType).toBe('inactive');
    expect(reactivate!.sourceRefs).toContain('retention:reactivate_inactive');
    expect(reactivate!.suggestedMessage.length).toBeGreaterThan(10);
    expect(reactivate!.limits.join(' ')).toMatch(/ROI|conversion/i);
    expect(proposals.some((p) => p.objectiveId === 'encourage_second_purchase')).toBe(true);
  });

  it('n’invente pas de produit phare si insufficient', () => {
    const proposals = buildMiCampaignProposals({
      period,
      dataQuality: 'insufficient',
      restaurantName: 'Chez Test',
      currency: 'XOF',
      retentionStrategies: [],
      topProducts: [{ name: 'Thieb', quantity: 20, revenue: 100_000, clients: 8 }],
      topClients: [],
      inactiveLoyal: [],
      segments: { new: 0, regular: 1, vip: 0, inactive: 0, at_risk: 0 },
      clientCount: 1,
    });
    expect(proposals.find((p) => p.objectiveId === 'promote_top_product')).toBeUndefined();
  });

  it('propose produit phare si volume et dataQuality ok', () => {
    const proposals = buildMiCampaignProposals({
      period,
      dataQuality: 'ok',
      restaurantName: 'Chez Test',
      currency: 'XOF',
      retentionStrategies: [],
      topProducts: [{ name: 'Thieboudienne', quantity: 12, revenue: 60_000, clients: 5 }],
      topClients: [],
      inactiveLoyal: [],
      segments: { new: 0, regular: 3, vip: 0, inactive: 0, at_risk: 0 },
      clientCount: 5,
    });
    const promo = proposals.find((p) => p.objectiveId === 'promote_top_product');
    expect(promo).toBeDefined();
    expect(promo!.audienceHeadcount).toBe(5);
    expect(promo!.campaignType).toBe('promotion');
    expect(promo!.analyticalJustification.some((j) => j.includes('Thieboudienne'))).toBe(true);
  });
});

describe('brouillons campagne', () => {
  it('valide name/type/message et refuse l’invalidité', () => {
    const proposals = buildMiCampaignProposals({
      period,
      dataQuality: 'ok',
      restaurantName: 'R',
      currency: 'XOF',
      retentionStrategies: [
        retention({ ruleId: 'thank_regular', segmentKey: 'regular', headcount: 3 }),
      ],
      topProducts: [],
      topClients: [],
      inactiveLoyal: [],
      segments: { new: 0, regular: 3, vip: 0, inactive: 0, at_risk: 0 },
      clientCount: 3,
    });
    const draft = buildMiCampaignDraftFromProposal(proposals[0]!);
    expect(draft.isDraftOnly).toBe(true);
    expect(draft.status).toBe('draft');
    expect(validateMiCampaignDraft(draft).ok).toBe(true);

    const bad = applyMiCampaignDraftEdits(draft, { name: '  ', message: '' });
    const v = validateMiCampaignDraft(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('marque user_edited après modification', () => {
    const proposals = buildMiCampaignProposals({
      period,
      dataQuality: 'ok',
      restaurantName: 'R',
      currency: 'XOF',
      retentionStrategies: [
        retention({ ruleId: 'nurture_at_risk', segmentKey: 'at_risk', headcount: 1 }),
      ],
      topProducts: [],
      topClients: [],
      inactiveLoyal: [],
      segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 1 },
      clientCount: 1,
    });
    const draft = buildMiCampaignDraftFromProposal(proposals[0]!);
    const edited = applyMiCampaignDraftEdits(draft, { message: 'Message personnalisé' });
    expect(edited.contentSource).toBe('user_edited');
    expect(edited.message).toBe('Message personnalisé');
  });
});
