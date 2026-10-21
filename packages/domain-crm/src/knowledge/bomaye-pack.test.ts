/**
 * Tests d’intégration pack Bomaye V2 — persistence code + règles déterministes.
 * Aucune donnée restaurant réelle.
 */
import { describe, expect, it } from 'vitest';
import {
  BOMAYE_KNOWLEDGE_SOURCE,
  BOMAYE_PACK,
  computeBomayeRatioPct,
  evaluateBomayeAdvisor,
  formatBomayeAdvisorAnswer,
  getBomayeAdaptationsForContext,
  getBomayePackSummary,
  getBomayeStrategy,
  listBomayeDecisionRules,
  listBomayeKpiFormulas,
  listBomayeStrategies,
  selectBomayeKnowledgeSlice,
} from './bomaye-pack';

describe('Bomaye knowledge pack — intégration A', () => {
  it('expose exactement 9 stratégies accessibles', () => {
    const list = listBomayeStrategies();
    expect(list).toHaveLength(9);
    expect(list.map((s) => s.id)).toEqual([
      'STRAT-01',
      'STRAT-02',
      'STRAT-03',
      'STRAT-04',
      'STRAT-05',
      'STRAT-06',
      'STRAT-07',
      'STRAT-08',
      'STRAT-09',
    ]);
    expect(getBomayeStrategy('STRAT-05')?.name).toMatch(/livraison/i);
  });

  it('règles décisionnelles présentes et interprétables', () => {
    const rules = listBomayeDecisionRules();
    expect(rules.length).toBeGreaterThanOrEqual(5);
    const dec01 = rules.find((r) => r.id === 'REGLE-DEC-01');
    expect(dec01?.thresholds.deliveryShareHighPct).toBe(25);
    expect(dec01?.narrative.then).toMatch(/plafonn/i);
  });

  it('formules et seuils KPI conservés', () => {
    const kpis = listBomayeKpiFormulas();
    const food = kpis.find((k) => k.id === 'KPI-FOOD-COST');
    expect(food?.expression).toMatch(/CA Net HT/i);
    expect(food?.recommendedThreshold).toMatch(/32/);
    expect(computeBomayeRatioPct(320, 1000)).toBe(32);
    expect(computeBomayeRatioPct(null, 1000)).toBeNull();
  });

  it('scripts WhatsApp récupérables (sauf STRAT-06 N/A)', () => {
    const withScript = listBomayeStrategies().filter((s) => s.whatsappScript);
    expect(withScript.length).toBeGreaterThanOrEqual(7);
    expect(getBomayeStrategy('STRAT-06')?.whatsappScript).toBeNull();
    expect(getBomayeStrategy('STRAT-04')?.whatsappScript).toMatch(/{{prenom}}/);
  });

  it('adaptations Afrique / Europe disponibles', () => {
    const africa = getBomayeAdaptationsForContext('africa');
    expect(africa.guidance.some((g) => /whatsapp/i.test(g))).toBe(true);
    expect(africa.guidance.some((g) => /uber eats/i.test(g))).toBe(true);
    const europe = getBomayeAdaptationsForContext('europe');
    expect(europe.guidance.some((g) => /agrégateur/i.test(g))).toBe(true);
  });

  it('provenance traçable jusqu’au document source', () => {
    const s = getBomayeStrategy('STRAT-08');
    expect(s?.source.documentId).toBe(BOMAYE_KNOWLEDGE_SOURCE.documentId);
    expect(s?.source.timestamps?.length).toBeGreaterThan(0);
    const slice = selectBomayeKnowledgeSlice({ strategyIds: ['STRAT-05'] });
    expect(slice.documentId).toBe(BOMAYE_KNOWLEDGE_SOURCE.documentId);
  });

  it('reste disponible après « rechargement » (réimport module)', async () => {
    const a = getBomayePackSummary();
    const reloaded = await import('./bomaye-pack');
    expect(reloaded.getBomayePackSummary()).toEqual(a);
    expect(reloaded.BOMAYE_PACK.strategies).toHaveLength(9);
  });
});

describe('Bomaye advisor — scénarios synthétiques (B)', () => {
  const synth = { dataOrigin: 'synthetic_test' as const };

  it('Test 1 — baisse fréquentation ≠ baisse générale des prix', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      visitsChangePct: -15,
      consideringGeneralPriceCutPct: 20,
    });
    expect(r.fires.some((f) => f.ruleId === 'CASE-PRICE-CUT')).toBe(true);
    const answer = formatBomayeAdvisorAnswer(r);
    expect(answer).toMatch(/ne pas recommander une baisse générale/i);
    expect(r.fires.flatMap((f) => f.contraindications).join(' ')).toMatch(/baisse générale/i);
    expect(r.primaryStrategies).toContain('STRAT-08');
  });

  it('Test 2 — dépendance livraison 45 %', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      deliverySharePct: 45,
      netMarginPct: 5,
    });
    expect(r.fires.some((f) => f.ruleId === 'REGLE-DEC-01')).toBe(true);
    expect(r.primaryStrategies).toContain('STRAT-05');
    expect(formatBomayeAdvisorAnswer(r)).toMatch(/livraison/i);
  });

  it('Test 3 — faible fidélisation : produit vs réactivation', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      repeatRate60dPct: 12,
    });
    expect(r.fires.some((f) => f.ruleId === 'REGLE-DEC-02')).toBe(true);
    expect(r.missingInformation.join(' ') + formatBomayeAdvisorAnswer(r)).toMatch(
      /avis|produit|r[eé]activation/i
    );
  });

  it('Test 4 — Food Cost > 32 % sans shrinkflation', () => {
    const r = evaluateBomayeAdvisor({ ...synth, foodCostPct: 34 });
    expect(r.fires.some((f) => f.ruleId === 'REGLE-DEC-03')).toBe(true);
    expect(r.fires.flatMap((f) => f.contraindications).join(' ')).toMatch(/shrinkflation|portions/i);
  });

  it('parse « Food Cost dépasse 32 % » déclenche REGLE-DEC-03 (pas égalité 32)', async () => {
    const { parseBomayeSignalsFromMessage } = await import('./bomaye-signal-parse');
    const signals = parseBomayeSignalsFromMessage(
      'Notre Food Cost dépasse 32 %. Dois-je réduire les portions ?'
    );
    expect(signals.foodCostPct).not.toBeNull();
    expect(signals.foodCostPct!).toBeGreaterThan(32);
    const r = evaluateBomayeAdvisor({ ...signals, dataOrigin: 'synthetic_test' });
    expect(r.fires.some((f) => f.ruleId === 'REGLE-DEC-03')).toBe(true);
  });

  it('Test 5 — préouverture → STRAT-02', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      phase: 'pre_opening',
      monthsToOpening: 4,
    });
    expect(r.primaryStrategies).toContain('STRAT-02');
    expect(r.fires.some((f) => f.ruleId === 'CASE-PREOPEN')).toBe(true);
  });

  it('Test 6 — aucune base contacts → STRAT-04', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      clientContactCount: 0,
      hasCrmOrLoyalty: false,
    });
    expect(r.primaryStrategies).toContain('STRAT-04');
    expect(formatBomayeAdvisorAnswer(r)).toMatch(/first-party|collecte/i);
  });

  it('Test 7 — contexte africain WhatsApp / Mobile Money', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      marketContext: 'africa',
      channels: ['whatsapp', 'cash', 'mobile_money'],
      clientContactCount: 0,
    });
    expect(r.marketGuidance.some((g) => /whatsapp/i.test(g))).toBe(true);
    expect(r.marketGuidance.join(' ')).toMatch(/mobile money|cash|uber eats/i);
  });

  it('Test 8 — diagnostic financier sans données', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      financialDiagnosisRequested: true,
    });
    expect(r.blockedOnMissingData).toBe(true);
    expect(r.missingInformation.length).toBeGreaterThan(0);
    expect(formatBomayeAdvisorAnswer(r)).toMatch(/aucun chiffre inventé|insuffisant/i);
  });

  it('Test 9 — avis négatifs avant campagne fréquentation', () => {
    const r = evaluateBomayeAdvisor({
      ...synth,
      avgReviewScore: 3.2,
      reviewTrendDown: true,
      visitsChangePct: -10,
    });
    expect(r.fires.some((f) => f.ruleId === 'CASE-NEGATIVE-REVIEWS')).toBe(true);
    expect(r.fires.flatMap((f) => f.contraindications).join(' ')).toMatch(
      /artificiellement|acquisition|campagne/i
    );
  });
});
