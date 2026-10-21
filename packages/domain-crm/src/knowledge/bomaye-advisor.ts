/**
 * Moteur de conseil déterministe Bomaye V2.
 * Évalue des signaux (CRM réels ou synthétiques explicitement marqués)
 * contre les règles du pack — sans LLM, sans invention de chiffres.
 */
import { getBomayeAdaptationsForContext, type BomayeMarketContext } from './bomaye-adaptations';
import {
  BOMAYE_DECISION_RULES,
  type BomayeDecisionRuleId,
} from './bomaye-decision-rules';
import { computeBomayeRatioPct, listBomayeKpiFormulas } from './bomaye-kpis';
import { BOMAYE_KNOWLEDGE_SOURCE } from './bomaye-source';
import {
  getBomayeStrategy,
  listBomayeStrategies,
  type BomayeStrategyId,
} from './bomaye-strategies';

export type BomayeDataOrigin = 'observed_crm' | 'synthetic_test' | 'user_declared' | 'missing';

export interface BomayeAdvisorSignals {
  /** Origine des données — obligatoire pour traçabilité tests / prod. */
  dataOrigin: BomayeDataOrigin;
  visitsChangePct?: number | null;
  /** Variation CA période vs précédente (ex. trends.revenue.changePct CRM). */
  revenueChangePct?: number | null;
  consideringGeneralPriceCutPct?: number | null;
  deliverySharePct?: number | null;
  netMarginPct?: number | null;
  repeatRate60dPct?: number | null;
  avgReviewScore?: number | null;
  reviewTrendDown?: boolean | null;
  foodCostPct?: number | null;
  /** Coût matières + CA pour calcul Food Cost si % absent. */
  foodCostAmount?: number | null;
  netRevenueHt?: number | null;
  clientContactCount?: number | null;
  hasCrmOrLoyalty?: boolean | null;
  phase?: 'pre_opening' | 'open' | 'expansion' | null;
  monthsToOpening?: number | null;
  monthsProfitable?: number | null;
  marketContext?: BomayeMarketContext | null;
  channels?: Array<'whatsapp' | 'sms' | 'cash' | 'mobile_money' | 'uber_eats' | 'card' | 'own_fleet'> | null;
  unconnectedTabletCount?: number | null;
  cashVariancePct?: number | null;
  /** Demande diagnostic financier sans fournir coûts/CA. */
  financialDiagnosisRequested?: boolean | null;
  restaurantName?: string | null;
}

/** Métadonnées de fusion CRM + déclaré (P2.1). */
export interface BomayeAdvisorEvalOptions {
  fieldOrigins?: Partial<Record<string, BomayeDataOrigin>>;
  conflicts?: Array<{
    field: string;
    observedValue: number | string | boolean | null;
    declaredValue: number | string | boolean | null;
    resolution: string;
    message: string;
  }>;
  crmFacts?: string[];
  crmLimits?: string[];
  miOpportunityRuleIds?: string[];
}

export interface BomayeRuleFire {
  ruleId: BomayeDecisionRuleId;
  matched: boolean;
  priority: 'critical' | 'high' | 'medium' | 'info';
  strategies: BomayeStrategyId[];
  recommendation: string;
  actions: string[];
  contraindications: string[];
  missingInputs: string[];
  provenance: {
    documentId: string;
    section: string;
    ruleId: BomayeDecisionRuleId;
  };
}

export interface BomayeAdvisorResult {
  source: typeof BOMAYE_KNOWLEDGE_SOURCE;
  dataOrigin: BomayeDataOrigin;
  computed: {
    foodCostPct: number | null;
    deliverySharePct: number | null;
  };
  fires: BomayeRuleFire[];
  primaryStrategies: BomayeStrategyId[];
  whatsappScripts: Array<{ strategyId: BomayeStrategyId; script: string }>;
  marketGuidance: string[];
  observedFacts: string[];
  missingInformation: string[];
  hypotheses: string[];
  summaryLines: string[];
  /** True si le système refuse de conclure faute de données. */
  blockedOnMissingData: boolean;
  /** Provenance par champ (P2.1). */
  fieldOrigins?: Partial<Record<string, BomayeDataOrigin>>;
  /** Contradictions déclaré vs observé (P2.1). */
  conflicts?: BomayeAdvisorEvalOptions['conflicts'];
}

function th(ruleId: BomayeDecisionRuleId, key: string): number {
  const rule = BOMAYE_DECISION_RULES.find((r) => r.id === ruleId);
  const v = rule?.thresholds[key];
  return typeof v === 'number' ? v : Number(v);
}

function fire(
  partial: Omit<BomayeRuleFire, 'provenance'> & { section: string }
): BomayeRuleFire {
  const { section, ...rest } = partial;
  return {
    ...rest,
    provenance: {
      documentId: BOMAYE_KNOWLEDGE_SOURCE.documentId,
      section,
      ruleId: rest.ruleId,
    },
  };
}

/**
 * Évalue les signaux contre le référentiel Bomaye.
 * Ne fabrique aucun KPI manquant.
 */
export function evaluateBomayeAdvisor(
  signals: BomayeAdvisorSignals,
  options?: BomayeAdvisorEvalOptions
): BomayeAdvisorResult {
  const foodCostPct =
    signals.foodCostPct ??
    computeBomayeRatioPct(signals.foodCostAmount, signals.netRevenueHt);

  const deliverySharePct =
    signals.deliverySharePct === undefined ? null : signals.deliverySharePct;

  const observedFacts: string[] = [];
  const missingInformation: string[] = [];
  const hypotheses: string[] = [];
  const fires: BomayeRuleFire[] = [];
  const origins = options?.fieldOrigins ?? {};

  const originOf = (field: string): BomayeDataOrigin =>
    origins[field] ?? signals.dataOrigin;

  const pushFact = (
    label: string,
    value: number | string | boolean | null | undefined,
    unit = '',
    field?: string
  ) => {
    if (value === null || value === undefined) return;
    const origin = field ? originOf(field) : signals.dataOrigin;
    observedFacts.push(`${label} = ${value}${unit} (origine: ${origin})`);
  };

  if (options?.crmFacts?.length) {
    for (const f of options.crmFacts) observedFacts.push(f);
  }

  pushFact('Variation fréquentation/visites', signals.visitsChangePct, ' %', 'visitsChangePct');
  pushFact('Variation CA', signals.revenueChangePct, ' %', 'revenueChangePct');
  pushFact(
    'Baisse prix générale envisagée',
    signals.consideringGeneralPriceCutPct,
    ' %',
    'consideringGeneralPriceCutPct'
  );
  pushFact('Part livraison', deliverySharePct, ' %', 'deliverySharePct');
  pushFact('Marge nette', signals.netMarginPct, ' %', 'netMarginPct');
  pushFact('Repeat rate 60 j', signals.repeatRate60dPct, ' %', 'repeatRate60dPct');
  pushFact('Note avis moyenne', signals.avgReviewScore, '', 'avgReviewScore');
  pushFact('Food Cost', foodCostPct, ' %', 'foodCostPct');
  pushFact('Contacts CRM', signals.clientContactCount, '', 'clientContactCount');
  pushFact('Mois avant ouverture', signals.monthsToOpening, '', 'monthsToOpening');
  pushFact('Mois rentables 1er site', signals.monthsProfitable, '', 'monthsProfitable');
  pushFact('Écart caisse', signals.cashVariancePct, ' %', 'cashVariancePct');
  pushFact('Tablettes non connectées', signals.unconnectedTabletCount, '', 'unconnectedTabletCount');

  if (signals.marketContext) {
    observedFacts.push(
      `Contexte marché = ${signals.marketContext} (origine: ${originOf('marketContext')})`
    );
  }
  if (signals.channels?.length) {
    observedFacts.push(
      `Canaux = ${signals.channels.join(', ')} (origine: ${originOf('channels')})`
    );
  }

  if (options?.conflicts?.length) {
    for (const c of options.conflicts) {
      hypotheses.push(`Conflit signal : ${c.message}`);
    }
  }
  if (options?.crmLimits?.length) {
    for (const l of options.crmLimits) {
      if (!missingInformation.includes(l) && /non dériv|indisponible|null|insuffisant/i.test(l)) {
        // Limites CRM informatives — pas des « missing inputs » de diagnostic financier.
        hypotheses.push(`Limite CRM : ${l}`);
      }
    }
  }

  // —— CASE: diagnostic financier sans données ——
  if (signals.financialDiagnosisRequested) {
    const hasFinance =
      foodCostPct !== null ||
      (signals.netRevenueHt !== null && signals.netRevenueHt !== undefined) ||
      (signals.foodCostAmount !== null && signals.foodCostAmount !== undefined) ||
      (signals.netMarginPct !== null && signals.netMarginPct !== undefined);
    if (!hasFinance) {
      missingInformation.push(
        'CA net HT',
        'Coût matières consommées (ou Food Cost %)',
        'Marge nette % (si connue)',
        'Part CA livraison (si applicable)'
      );
      fires.push(
        fire({
          ruleId: 'CASE-INSUFFICIENT-FINANCE',
          section: 'Doctrine + STRAT-08',
          matched: true,
          priority: 'critical',
          strategies: ['STRAT-08'],
          recommendation:
            'Diagnostic financier impossible sans coûts ni CA — aucun chiffre inventé.',
          actions: [
            'Fournir CA net HT de la période',
            'Fournir coût matières consommées ou Food Cost %',
            'Optionnel : masse salariale chargée, part livraison, marge nette',
          ],
          contraindications: ['Inventer un Food Cost, une marge ou un CA'],
          missingInputs: [...missingInformation],
        })
      );
    }
  }

  // —— CASE: baisse fréquentation / CA + baisse prix générale ——
  const visitsDrop =
    signals.visitsChangePct !== null &&
    signals.visitsChangePct !== undefined &&
    signals.visitsChangePct < 0;
  const revenueDrop =
    signals.revenueChangePct !== null &&
    signals.revenueChangePct !== undefined &&
    signals.revenueChangePct < 0;
  const significantActivityDrop =
    (signals.visitsChangePct !== null &&
      signals.visitsChangePct !== undefined &&
      signals.visitsChangePct <= -20) ||
    (signals.revenueChangePct !== null &&
      signals.revenueChangePct !== undefined &&
      signals.revenueChangePct <= -20) ||
    (options?.miOpportunityRuleIds ?? []).some(
      (id) => id === 'revenue_drop_significant' || id === 'visits_drop_significant'
    );
  const priceCut =
    signals.consideringGeneralPriceCutPct !== null &&
    signals.consideringGeneralPriceCutPct !== undefined &&
    signals.consideringGeneralPriceCutPct >= 10;
  if ((visitsDrop || revenueDrop) && priceCut) {
    fires.push(
      fire({
        ruleId: 'CASE-PRICE-CUT',
        section: 'F / Cas 1',
        matched: true,
        priority: 'critical',
        strategies: ['STRAT-08', 'STRAT-03', 'STRAT-04'],
        recommendation:
          'Ne pas recommander une baisse générale des prix : risque de destruction de marge (métier de sentimier). Préférer leviers ciblés.',
        actions: [
          'Conserver un plat / burger d’appel à prix doux',
          'Lancer une collab / drop éphémère (STRAT-03) si ops stables et avis OK',
          'WhatsApp aux fidèles inactifs (offre expérience, pas bradage)',
        ],
        contraindications: [
          'Baisse générale ~20 % des prix bruts pour « remplir »',
          'Shrinkflation / réduction secrète des portions',
        ],
        missingInputs: [],
      })
    );
  } else if (significantActivityDrop && !priceCut) {
    fires.push(
      fire({
        ruleId: 'CASE-PRICE-CUT',
        section: 'F / Cas 1 + CRM trends',
        matched: true,
        priority: 'high',
        strategies: ['STRAT-08', 'STRAT-03', 'STRAT-04'],
        recommendation:
          'Baisse d’activité significative observée dans le CRM — ne pas réagir par une baisse générale des prix ; examiner produit, avis et leviers ciblés (drops, réactivation).',
        actions: [
          'Vérifier régularité produit et avis avant toute promo prix',
          'Envisager drop / collab (STRAT-03) si ops stables',
          'Réactiver les clients inactifs via CRM (STRAT-04) si base disponible',
        ],
        contraindications: [
          'Baisse générale automatique des prix pour « remplir »',
          'Shrinkflation / réduction secrète des portions',
        ],
        missingInputs: priceCut ? [] : [],
      })
    );
  } else if ((visitsDrop || revenueDrop) && !priceCut) {
    hypotheses.push(
      'Baisse d’activité observée — sans projet de baisse de prix déclaré ; examiner produit, avis, CRM et animation avant promo prix.'
    );
  }

  // —— REGLE-DEC-01 livraison ——
  if (deliverySharePct !== null && deliverySharePct !== undefined) {
    const high = th('REGLE-DEC-01', 'deliveryShareHighPct');
    const lowMargin = th('REGLE-DEC-01', 'netMarginLowPct');
    const lowShare = th('REGLE-DEC-01', 'deliveryShareLowPct');
    if (deliverySharePct > high) {
      const marginKnown = signals.netMarginPct !== null && signals.netMarginPct !== undefined;
      const marginBad = marginKnown && (signals.netMarginPct as number) < lowMargin;
      const missing: string[] = [];
      if (!marginKnown) missing.push('marge nette %');
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-01',
          section: 'E / REGLE-DEC-01',
          matched: true,
          priority: marginBad || !marginKnown ? 'critical' : 'high',
          strategies: ['STRAT-05'],
          recommendation: marginBad
            ? `Dépendance livraison ${deliverySharePct} % > ${high} % et marge nette < ${lowMargin} % — plafonner agrégateurs et drive-to-store.`
            : `Dépendance livraison ${deliverySharePct} % > seuil Bomaye ${high} % — traiter comme risque de vampirisation des marges (STRAT-05).${
                missing.length ? ' Marge nette manquante pour confirmer REGLE-DEC-01 complète.' : ''
              }`,
          actions: [
            `Plafonner part livraison vers ${th('REGLE-DEC-01', 'destinationCapTargetPct')} % CA (cible Bomaye)`,
            'Arrêter / réduire promo sponsorisée sur agrégateurs',
            `Majoration prix livraison ${th('REGLE-DEC-01', 'deliveryPriceUpliftMinPct')}–${th('REGLE-DEC-01', 'deliveryPriceUpliftMaxPct')} % si autorisé`,
            'Flyer / WhatsApp → expérience salle non livrable',
          ],
          contraindications: [
            'Augmenter l’acquisition livraison tant que la dépendance est élevée',
          ],
          missingInputs: missing,
        })
      );
      missingInformation.push(...missing);
    } else if (deliverySharePct < lowShare) {
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-01',
          section: 'E / REGLE-DEC-01',
          matched: true,
          priority: 'info',
          strategies: ['STRAT-05'],
          recommendation:
            'Part livraison basse — la livraison peut servir de vitrine ponctuelle si heures creuses (SINON de REGLE-DEC-01).',
          actions: ['Utiliser livraison comme visibilité promo ponctuelle si salle creuse'],
          contraindications: [],
          missingInputs: [],
        })
      );
    }
  }

  // —— REGLE-DEC-02 / avis / fidélisation ——
  const reviewCritical = th('REGLE-DEC-02', 'reviewCriticalMax');
  const reviewStable = th('REGLE-DEC-02', 'reviewStableMin');
  const repeatLow = th('REGLE-DEC-02', 'repeatRateLowPct');

  const reviewsBad =
    (signals.avgReviewScore !== null &&
      signals.avgReviewScore !== undefined &&
      signals.avgReviewScore < reviewCritical) ||
    signals.reviewTrendDown === true;

  if (reviewsBad) {
    fires.push(
      fire({
        ruleId: 'CASE-NEGATIVE-REVIEWS',
        section: 'E / REGLE-DEC-02',
        matched: true,
        priority: 'critical',
        strategies: ['STRAT-08'],
        recommendation:
          'Avis / note en baisse — priorité produit et opérations avant toute campagne d’acquisition.',
        actions: [
          'Auditer fiches techniques et régularité cuisine',
          'Former équipes / temps de service',
          'Bloquer dépenses marketing d’acquisition tant que note < seuil critique Bomaye',
        ],
        contraindications: [
          'Campagne destinée à augmenter artificiellement la fréquentation',
          'Drop / collab tant que la qualité n’est pas rétablie',
        ],
        missingInputs:
          signals.avgReviewScore === null || signals.avgReviewScore === undefined
            ? ['note moyenne avis (si disponible)']
            : [],
      })
    );
  }

  if (
    signals.repeatRate60dPct !== null &&
    signals.repeatRate60dPct !== undefined &&
    signals.repeatRate60dPct < repeatLow
  ) {
    if (reviewsBad) {
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-02',
          section: 'E / REGLE-DEC-02',
          matched: true,
          priority: 'critical',
          strategies: ['STRAT-08'],
          recommendation:
            'Faible taux de retour + signal qualité négatif — diagnostic produit avant réactivation marketing.',
          actions: ['Audit qualité / ops avant toute relance WhatsApp massive'],
          contraindications: ['Lancer Drop ou campagne acquisition'],
          missingInputs: [],
        })
      );
    } else {
      const reviewKnown =
        signals.avgReviewScore !== null && signals.avgReviewScore !== undefined;
      const reviewOk = reviewKnown && (signals.avgReviewScore as number) >= reviewStable;
      const missing: string[] = [];
      if (!reviewKnown) {
        missing.push('note moyenne avis clients');
        missingInformation.push('note moyenne avis clients');
      }
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-02',
          section: 'E / REGLE-DEC-02',
          matched: true,
          priority: 'high',
          strategies: reviewOk ? ['STRAT-03', 'STRAT-04'] : ['STRAT-04', 'STRAT-08'],
          recommendation: reviewOk
            ? `Repeat rate ${signals.repeatRate60dPct} % < ${repeatLow} % et avis stables — envisager Drop mensuel + teasing WhatsApp (STRAT-03/04).`
            : `Repeat rate ${signals.repeatRate60dPct} % < ${repeatLow} % — distinguer problème produit vs manque de réactivation. ${
                missing.length ? 'Données avis manquantes pour trancher.' : 'Examiner qualité avant campagne.'
              }`,
          actions: reviewOk
            ? [
                'Lancer collaboration mensuelle éphémère si brigade stable',
                'Teasing WhatsApp base CRM',
                'Vérifier collecte first-party (STRAT-04)',
              ]
            : [
                'Demander / mesurer note avis et régularité produit',
                'Vérifier existence d’une base de contacts',
                'Ne pas lancer de campagne acquisition tant que le diagnostic produit n’est pas clarifié',
              ],
          contraindications: reviewsBad
            ? ['Campagne acquisition']
            : ['Assumer que c’est « seulement » du marketing sans vérifier le produit'],
          missingInputs: missing,
        })
      );
    }
  } else if (
    signals.repeatRate60dPct === null ||
    signals.repeatRate60dPct === undefined
  ) {
    if (signals.clientContactCount === 0 || signals.hasCrmOrLoyalty === false) {
      // handled below
    }
  }

  // —— REGLE-DEC-03 Food Cost ——
  const foodCritical = th('REGLE-DEC-03', 'foodCostCriticalPct');
  if (foodCostPct !== null && foodCostPct > foodCritical) {
    fires.push(
      fire({
        ruleId: 'REGLE-DEC-03',
        section: 'E / REGLE-DEC-03',
        matched: true,
        priority: 'critical',
        strategies: ['STRAT-08'],
        recommendation: `Food Cost ${foodCostPct} % > ${foodCritical} % (seuil Bomaye) — réévaluation fiches techniques / prix ciblés, jamais shrinkflation.`,
        actions: [
          'Recalculer fiches techniques plat par plat',
          `Ajustement sélectif prix ${th('REGLE-DEC-03', 'priceAdjustMinEur')}–${th('REGLE-DEC-03', 'priceAdjustMaxEur')} € sur plats faible sensibilité-prix`,
          'Maintenir un produit d’appel accessible',
          'Communiquer transparence qualité / fait maison',
        ],
        contraindications: [
          'Réduire secrètement la taille des portions (shrinkflation)',
          'Baisse de qualité des ingrédients pour « sauver » la marge',
        ],
        missingInputs: [],
      })
    );
  } else if (
    signals.financialDiagnosisRequested &&
    foodCostPct === null &&
    !fires.some((f) => f.ruleId === 'CASE-INSUFFICIENT-FINANCE')
  ) {
    missingInformation.push('Food Cost % ou (coût matières + CA HT)');
  }

  // —— STRAT-02 préouverture ——
  const preOpenMin = th('CASE-PREOPEN', 'preOpenMinMonths');
  if (
    signals.phase === 'pre_opening' ||
    (signals.monthsToOpening !== null &&
      signals.monthsToOpening !== undefined &&
      signals.monthsToOpening >= preOpenMin)
  ) {
    fires.push(
      fire({
        ruleId: 'CASE-PREOPEN',
        section: 'D / STRAT-02',
        matched: true,
        priority: 'high',
        strategies: ['STRAT-02', 'STRAT-04'],
        recommendation:
          'Préouverture — activer Pre-Launch Audience Building et préparer collecte first-party jour 1.',
        actions: [
          'Documenter la genèse en public (réseaux)',
          'Engager la communauté avant ouverture',
          'Prévoir tablette / WhatsApp fidélité dès le jour 1 (STRAT-04)',
        ],
        contraindications: [
          'Attendre d’avoir « assez de clients » pour installer un CRM',
        ],
        missingInputs: [],
      })
    );
  }

  // —— STRAT-04 / pas de contacts ——
  const noContacts =
    signals.clientContactCount === 0 ||
    signals.hasCrmOrLoyalty === false ||
    (signals.clientContactCount !== null &&
      signals.clientContactCount !== undefined &&
      signals.clientContactCount < 1);
  if (noContacts) {
    fires.push(
      fire({
        ruleId: 'CASE-NO-CONTACTS',
        section: 'F / Cas 3 + STRAT-04',
        matched: true,
        priority: 'high',
        strategies: ['STRAT-04'],
        recommendation:
          'Aucune base de contacts exploitable — priorité collecte consentie first-party et fidélisation avant pub payante.',
        actions: [
          'Installer collecte téléphone / WhatsApp avec consentement en caisse (< 10 s)',
          'Former l’équipe salle à l’invitation',
          'Reporter investissements pub massifs jusqu’à disposer d’un canal de recontact',
        ],
        contraindications: [
          'Investir d’abord en publicité payante sans canal de recontact',
        ],
        missingInputs: [],
      })
    );
  }

  // —— REGLE-DEC-04 expansion ——
  if (signals.phase === 'expansion') {
    const minMonths = th('REGLE-DEC-04', 'minMonthsProfitableBeforeExpansion');
    const months = signals.monthsProfitable;
    if (months === null || months === undefined) {
      missingInformation.push('mois consécutifs de rentabilité opérationnelle positive du 1er site');
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-04',
          section: 'E / REGLE-DEC-04',
          matched: true,
          priority: 'high',
          strategies: ['STRAT-09'],
          recommendation:
            'Expansion demandée — données de rentabilité du 1er site manquantes ; ne pas valider sans elles.',
          actions: [
            `Confirmer ≥ ${minMonths} mois de rentabilité positive avant 2e site`,
            'Conserver 100 % du nom de marque',
            'Adapter ~50 % de l’offre / format à la zone',
          ],
          contraindications: ['Franchise précipitée', 'Copier-coller aveugle'],
          missingInputs: [
            'mois consécutifs de rentabilité opérationnelle positive du 1er site',
          ],
        })
      );
    } else if (months < minMonths) {
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-04',
          section: 'E / REGLE-DEC-04',
          matched: true,
          priority: 'critical',
          strategies: ['STRAT-09'],
          recommendation: `1er site rentable seulement ${months} mois < ${minMonths} — alerte asphyxie financière ; consolider avant expansion.`,
          actions: ['Consolider le modèle initial', 'Reporter ouverture multi-sites'],
          contraindications: ['Ouvrir 2e site maintenant', 'Franchise précoce'],
          missingInputs: [],
        })
      );
    } else {
      fires.push(
        fire({
          ruleId: 'REGLE-DEC-04',
          section: 'E / REGLE-DEC-04',
          matched: true,
          priority: 'medium',
          strategies: ['STRAT-09'],
          recommendation:
            'Rentabilité 1er site suffisante (seuil Bomaye) — expansion possible avec marque unique + adaptation zone.',
          actions: [
            'Garder 100 % du nom',
            'Socle 50–70 % recettes signatures',
            'Étude de zone avant clonage',
          ],
          contraindications: ['Changer de nom selon les lieux'],
          missingInputs: [],
        })
      );
    }
  }

  // —— REGLE-DEC-05 stack ——
  const cashCrit = th('REGLE-DEC-05', 'cashVarianceCriticalPct');
  const maxTablets = th('REGLE-DEC-05', 'maxUnconnectedTablets');
  if (
    (signals.cashVariancePct !== null &&
      signals.cashVariancePct !== undefined &&
      signals.cashVariancePct > cashCrit) ||
    (signals.unconnectedTabletCount !== null &&
      signals.unconnectedTabletCount !== undefined &&
      signals.unconnectedTabletCount > maxTablets)
  ) {
    fires.push(
      fire({
        ruleId: 'REGLE-DEC-05',
        section: 'E / REGLE-DEC-05',
        matched: true,
        priority: 'high',
        strategies: ['STRAT-06'],
        recommendation:
          'Écarts de caisse ou usine à gaz tablettes — unification caisse-TPE API avant nouveaux SaaS d’animation.',
        actions: [
          'Auditer doubles saisies',
          'Unifier caisse et TPE par API',
          'Proscrire nouvel outil d’animation tant que non unifié',
        ],
        contraindications: ['Empiler un SaaS supplémentaire'],
        missingInputs: [],
      })
    );
  }

  // —— Contexte marché ——
  const market = getBomayeAdaptationsForContext(signals.marketContext ?? 'unknown');
  const marketGuidance = [...market.guidance];
  if (signals.marketContext === 'africa') {
    if (signals.channels?.includes('whatsapp') || !signals.channels?.length) {
      marketGuidance.push(
        'Scripts et relances : privilégier WhatsApp conversationnel (adaptation §I).'
      );
    }
    if (
      signals.channels?.includes('cash') ||
      signals.channels?.includes('mobile_money')
    ) {
      marketGuidance.push(
        'Pilotage encaissements cash / Mobile Money — ne pas exiger TPE européen.'
      );
    }
  }

  const matched = fires.filter((f) => f.matched);
  const primaryStrategies = Array.from(
    new Set(matched.flatMap((f) => f.strategies))
  ) as BomayeStrategyId[];

  const whatsappScripts = primaryStrategies
    .map((id) => {
      const s = getBomayeStrategy(id);
      if (!s?.whatsappScript) return null;
      const name = signals.restaurantName?.trim() || '{{restaurant}}';
      return {
        strategyId: id,
        script: s.whatsappScript.replace(/\{\{restaurant\}\}/g, name),
      };
    })
    .filter((x): x is { strategyId: BomayeStrategyId; script: string } => x !== null);

  const blockedOnMissingData = matched.some(
    (f) => f.ruleId === 'CASE-INSUFFICIENT-FINANCE' && f.priority === 'critical'
  );

  const summaryLines: string[] = [];
  if (blockedOnMissingData) {
    summaryLines.push(
      'Limite : données financières insuffisantes — questions ciblées plutôt que chiffres inventés.'
    );
  }
  for (const f of matched.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, info: 3 };
    return rank[a.priority] - rank[b.priority];
  })) {
    summaryLines.push(`[${f.priority}] ${f.ruleId}: ${f.recommendation}`);
  }
  if (summaryLines.length === 0) {
    summaryLines.push(
      'Aucun signal Bomaye critique déclenché avec les données fournies — préciser indicateurs ou question.'
    );
  }

  // Dédup missing
  const missingUnique = Array.from(new Set(missingInformation));

  return {
    source: BOMAYE_KNOWLEDGE_SOURCE,
    dataOrigin: signals.dataOrigin,
    computed: { foodCostPct, deliverySharePct },
    fires: matched,
    primaryStrategies,
    whatsappScripts,
    marketGuidance,
    observedFacts,
    missingInformation: missingUnique,
    hypotheses,
    summaryLines,
    blockedOnMissingData,
    fieldOrigins: options?.fieldOrigins,
    conflicts: options?.conflicts,
  };
}

/** Sélectionne un sous-ensemble compact du pack pour injection prompt / chat. */
export function selectBomayeKnowledgeSlice(input: {
  strategyIds?: BomayeStrategyId[];
  includeKpis?: boolean;
  marketContext?: BomayeMarketContext;
}): Record<string, unknown> {
  const ids = input.strategyIds?.length
    ? input.strategyIds
    : listBomayeStrategies().map((s) => s.id);
  const strategies = ids
    .map((id) => getBomayeStrategy(id))
    .filter(Boolean)
    .map((s) => ({
      id: s!.id,
      name: s!.name,
      objective: s!.objective,
      decisionRule: s!.decisionRule,
      contraindications: s!.contraindications,
      formula: s!.formula,
      whatsappScript: s!.whatsappScript,
      source: s!.source,
    }));

  return {
    documentId: BOMAYE_KNOWLEDGE_SOURCE.documentId,
    version: BOMAYE_KNOWLEDGE_SOURCE.version,
    scopeNote: BOMAYE_KNOWLEDGE_SOURCE.scopeNote,
    strategies,
    decisionRules: BOMAYE_DECISION_RULES.filter((r) =>
      r.relatedStrategies.some((sid) => ids.includes(sid))
    ).map((r) => ({
      id: r.id,
      name: r.name,
      narrative: r.narrative,
      thresholds: r.thresholds,
    })),
    kpis: input.includeKpis ? listBomayeKpiFormulas() : undefined,
    market: getBomayeAdaptationsForContext(input.marketContext ?? 'unknown'),
  };
}

/** Formate une réponse déterministe pour le chat MI. */
export function formatBomayeAdvisorAnswer(result: BomayeAdvisorResult): string {
  const lines: string[] = [
    `Conseil métier Bomaye (réf. ${result.source.documentId} v${result.source.version}).`,
    `Origine des données : ${result.dataOrigin}.`,
    `Périmètre : ${result.source.scopeNote}`,
    '',
  ];

  if (result.observedFacts.length) {
    lines.push('Faits pris en compte :');
    for (const f of result.observedFacts) lines.push(`• ${f}`);
    lines.push('');
  }

  if (result.missingInformation.length) {
    lines.push('Informations manquantes :');
    for (const m of result.missingInformation) lines.push(`• ${m}`);
    lines.push('');
  }

  if (result.hypotheses.length) {
    lines.push('Hypothèses / limites (non des faits CRM inventés) :');
    for (const h of result.hypotheses) lines.push(`• ${h}`);
    lines.push('');
  }

  if (result.conflicts?.length) {
    lines.push('Divergences déclaré vs observé (CRM conservé) :');
    for (const c of result.conflicts) lines.push(`• ${c.message}`);
    lines.push('');
  }

  lines.push('Recommandations :');
  for (const s of result.summaryLines) lines.push(`• ${s}`);
  lines.push('');

  if (result.primaryStrategies.length) {
    lines.push(`Stratégies liées : ${result.primaryStrategies.join(', ')}`);
  }

  const nextActions = Array.from(
    new Set(result.fires.flatMap((f) => f.actions))
  ).slice(0, 8);
  if (nextActions.length) {
    lines.push('', 'Prochaines actions concrètes :');
    for (const a of nextActions) lines.push(`• ${a}`);
  }

  const criticalActions = result.fires.flatMap((f) =>
    f.contraindications.map((c) => `Ne pas : ${c}`)
  );
  if (criticalActions.length) {
    lines.push('', 'Contre-indications :');
    for (const c of Array.from(new Set(criticalActions)).slice(0, 8)) {
      lines.push(`• ${c}`);
    }
  }

  if (result.marketGuidance.length) {
    lines.push('', 'Adaptation marché :');
    for (const g of result.marketGuidance.slice(0, 5)) lines.push(`• ${g}`);
  }

  if (result.whatsappScripts[0]) {
    lines.push(
      '',
      `Script WhatsApp (brouillon, non envoyé) — ${result.whatsappScripts[0].strategyId} :`,
      result.whatsappScripts[0].script
    );
  }

  lines.push(
    '',
    'Aucun envoi WhatsApp / campagne réelle. Seuils = source Bomaye, pas une garantie universelle.'
  );

  return lines.join('\n');
}
