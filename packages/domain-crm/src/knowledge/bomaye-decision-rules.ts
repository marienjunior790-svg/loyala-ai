/**
 * Règles décisionnelles SI / ALORS / SINON — Bomaye V2 §E + règles par stratégie.
 * Seuils = source documentée ; testables sans LLM.
 */
import { BOMAYE_KNOWLEDGE_SOURCE } from './bomaye-source';
import type { BomayeStrategyId } from './bomaye-strategies';

export type BomayeDecisionRuleId =
  | 'REGLE-DEC-01'
  | 'REGLE-DEC-02'
  | 'REGLE-DEC-03'
  | 'REGLE-DEC-04'
  | 'REGLE-DEC-05'
  | 'CASE-PRICE-CUT'
  | 'CASE-NO-CONTACTS'
  | 'CASE-PREOPEN'
  | 'CASE-NEGATIVE-REVIEWS'
  | 'CASE-INSUFFICIENT-FINANCE';

export interface BomayeDecisionRule {
  id: BomayeDecisionRuleId;
  name: string;
  section: string;
  relatedStrategies: BomayeStrategyId[];
  /** Description textuelle SI / ALORS / SINON (provenance). */
  narrative: {
    if: string;
    then: string;
    elseIf?: string;
    elseThen?: string;
  };
  /** Seuils issus du document (indicatif Bomaye, pas universel). */
  thresholds: Record<string, number | string>;
  sourceTimestamps?: string[];
}

export const BOMAYE_DECISION_RULES: readonly BomayeDecisionRule[] = [
  {
    id: 'REGLE-DEC-01',
    name: 'Arbitrage de la livraison tierce',
    section: 'E',
    relatedStrategies: ['STRAT-05'],
    narrative: {
      if: 'Part CA Uber Eats / Deliveroo > 25 % ET marge nette < 8 %',
      then:
        'Plafonner promo plateformes ; majorer prix livraison 15–20 % ; campagne attractivité salle (expériences non livrables)',
      elseIf: 'Part livraison < 5 % ET heures creuses en salle',
      elseThen: 'Utiliser la livraison comme canal de visibilité promotionnelle ponctuelle',
    },
    thresholds: {
      deliveryShareHighPct: 25,
      netMarginLowPct: 8,
      deliveryShareLowPct: 5,
      deliveryPriceUpliftMinPct: 15,
      deliveryPriceUpliftMaxPct: 20,
      destinationCapTargetPct: 15,
    },
  },
  {
    id: 'REGLE-DEC-02',
    name: 'Diagnostic érosion du taux de retour (churn)',
    section: 'E',
    relatedStrategies: ['STRAT-03', 'STRAT-04', 'STRAT-08'],
    narrative: {
      if: 'Repeat rate 60 j < 20 % (concept fast-casual)',
      then:
        'Analyser d’abord la régularité produit. Si note avis stable (> 4.5) → Drop mensuel + teasing WhatsApp',
      elseIf: 'Note moyenne client < 4.0',
      elseThen:
        'Bloquer dépenses marketing ; auditer fiches techniques, formation équipes, temps de service',
    },
    thresholds: {
      repeatRateLowPct: 20,
      reviewStableMin: 4.5,
      reviewCriticalMax: 4.0,
    },
  },
  {
    id: 'REGLE-DEC-03',
    name: 'Inflation & révision des fiches techniques',
    section: 'E',
    relatedStrategies: ['STRAT-08'],
    narrative: {
      if: 'Food Cost > 32 % du CA net sur le mois',
      then:
        'Refuser shrinkflation. Ajustement sélectif prix 0,50–1,50 € sur plats faible sensibilité-prix ; produit d’appel accessible',
      elseIf: 'Food Cost ≤ 32 %',
      elseThen: 'Maintenir grille tarifaire ; négocier volumes fournisseurs',
    },
    thresholds: {
      foodCostCriticalPct: 32,
      priceAdjustMinEur: 0.5,
      priceAdjustMaxEur: 1.5,
    },
  },
  {
    id: 'REGLE-DEC-04',
    name: 'Lancement d’un deuxième point de vente',
    section: 'E',
    relatedStrategies: ['STRAT-09'],
    narrative: {
      if: 'Ouverture 2e site alors que 1er < 12 mois de rentabilité opérationnelle positive',
      then: 'Alerte asphyxie financière — consolider le modèle initial',
      elseIf: '1er site rentable > 12 mois',
      elseThen:
        'Expansion OK : 100 % nom marque + ~50 % carte socle + adaptation zone',
    },
    thresholds: {
      minMonthsProfitableBeforeExpansion: 12,
      brandNameRetentionPct: 100,
      sharedMenuPct: 50,
    },
  },
  {
    id: 'REGLE-DEC-05',
    name: 'Stack digitale & erreurs de caisse',
    section: 'E',
    relatedStrategies: ['STRAT-06'],
    narrative: {
      if: 'Écarts de caisse quotidiens > 1 % du CA OU > 2 tablettes non interfacées',
      then:
        'Proscrire nouvel outil SaaS d’animation ; exiger unification caisse-TPE API',
    },
    thresholds: {
      cashVarianceCriticalPct: 1,
      maxUnconnectedTablets: 2,
    },
  },
  {
    id: 'CASE-PRICE-CUT',
    name: 'Contre-indication baisse générale des prix (cas F1)',
    section: 'F / Cas 1',
    relatedStrategies: ['STRAT-03', 'STRAT-04', 'STRAT-08'],
    narrative: {
      if: 'Baisse fréquentation + projet de baisse générale des prix (~20 %)',
      then:
        'Ne pas brader : produit d’appel + drop collab + WhatsApp fidèles inactifs — pas baisse générale',
    },
    thresholds: {
      illustrativeVisitsDropPct: 15,
      illustrativeGeneralCutPct: 20,
    },
  },
  {
    id: 'CASE-NO-CONTACTS',
    name: 'Priorité collecte first-party (cas F3 / STRAT-04)',
    section: 'F / Cas 3',
    relatedStrategies: ['STRAT-04'],
    narrative: {
      if: 'Aucune base de contacts exploitable / CRM absent',
      then: 'Installer collecte consentie dès maintenant / dès ouverture avant pub payante',
    },
    thresholds: {},
  },
  {
    id: 'CASE-PREOPEN',
    name: 'Préouverture > 3 mois → audience building',
    section: 'D / STRAT-02',
    relatedStrategies: ['STRAT-02', 'STRAT-04'],
    narrative: {
      if: 'Pré-ouverture avec délai > 3 mois',
      then: 'Build in Public + préparer collecte first-party jour 1',
    },
    thresholds: {
      preOpenMinMonths: 3,
    },
    sourceTimestamps: ['00:14:00-00:16:15'],
  },
  {
    id: 'CASE-NEGATIVE-REVIEWS',
    name: 'Avis négatifs / note en baisse — bloquer acquisition',
    section: 'E / REGLE-DEC-02',
    relatedStrategies: ['STRAT-08'],
    narrative: {
      if: 'Note moyenne < 4.0 ou tendance avis négatifs',
      then:
        'Priorité produit / ops / fiches techniques — pas de campagne pour augmenter artificiellement la fréquentation',
    },
    thresholds: {
      reviewCriticalMax: 4.0,
    },
  },
  {
    id: 'CASE-INSUFFICIENT-FINANCE',
    name: 'Diagnostic financier sans données',
    section: 'Doctrine + STRAT-08',
    relatedStrategies: ['STRAT-08'],
    narrative: {
      if: 'Demande diagnostic financier sans coûts ni CA',
      then: 'Refuser d’inventer des chiffres ; demander Food Cost, CA HT, masse salariale, part livraison',
    },
    thresholds: {},
  },
] as const;

export const BOMAYE_PILLARS = [
  {
    id: 'PILLAR-01',
    text: 'Marketing ~50 % du succès, Produit ~50 % — sans produit irréprochable, pas de réachat',
    timestamps: ['00:20:05'],
  },
  {
    id: 'PILLAR-02',
    text: 'Restauration = métier de sentimier (invisible ~80 %) — piloter marges au centime',
    timestamps: ['00:28:40', '00:32:15'],
  },
  {
    id: 'PILLAR-03',
    text: 'First-party data dès le jour d’ouverture',
    timestamps: ['00:49:25'],
  },
  {
    id: 'PILLAR-04',
    text: 'Plafonner livraison tierce (~10 % CA) pour rester restaurant de destination',
    timestamps: ['00:53:30'],
  },
  {
    id: 'PILLAR-05',
    text: 'Interopérabilité logicielle (API ouvertes) — fuir l’usine à gaz tablettes',
    timestamps: ['00:46:50'],
  },
] as const;

export const BOMAYE_FREQUENT_ERRORS = [
  {
    id: 'ERR-VANITY-METRICS',
    title: 'Illusion des vanity metrics réseaux sociaux',
    detail:
      'Vues / likes ne paient pas les factures ; convertir en déplacement physique.',
    timestamps: ['00:15:50'],
  },
  {
    id: 'ERR-EARLY-FRANCHISE',
    title: 'Franchise précipitée (« franchisite »)',
    detail: 'Rodage 3–5 établissements en propre avant franchise.',
    timestamps: ['00:33:50', '00:36:20'],
  },
  {
    id: 'ERR-SOLO',
    title: 'Entreprendre seul en restauration',
    detail: 'Binôme complémentaire, notamment finance, condition de survie.',
    timestamps: ['00:43:20', '00:44:20'],
  },
  {
    id: 'ERR-RENAME',
    title: 'Changer de nom de restaurant dans un même groupe (indépendant)',
    detail: 'Marteler un nom unique pour notoriété cumulative.',
    timestamps: ['00:39:35'],
  },
] as const;

export function listBomayeDecisionRules(): readonly BomayeDecisionRule[] {
  return BOMAYE_DECISION_RULES;
}

export function getBomayeDecisionRule(id: BomayeDecisionRuleId): BomayeDecisionRule | undefined {
  return BOMAYE_DECISION_RULES.find((r) => r.id === id);
}

void BOMAYE_KNOWLEDGE_SOURCE;
