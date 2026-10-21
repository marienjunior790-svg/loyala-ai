/**
 * P2.1 — Pont CRM → Bomaye.
 * Dérive des signaux Bomaye depuis MiOrgInsights (faits observés).
 * Aucun Food Cost / marge / ROI inventé.
 */
import type { MiOrgInsights } from '../mi-tools';
import type { MiOpportunityRuleId } from '../mi-opportunities';
import type { BomayeAdvisorSignals, BomayeDataOrigin } from './bomaye-advisor';

/** Champs numériques/comparables pour détection de conflit déclaré vs observé. */
export type BomayeBridgeableField =
  | 'visitsChangePct'
  | 'revenueChangePct'
  | 'clientContactCount'
  | 'consideringGeneralPriceCutPct'
  | 'deliverySharePct'
  | 'netMarginPct'
  | 'repeatRate60dPct'
  | 'avgReviewScore'
  | 'foodCostPct';

export interface BomayeSignalConflict {
  field: BomayeBridgeableField | string;
  observedValue: number | string | boolean | null;
  declaredValue: number | string | boolean | null;
  /** Règle P2.1 : l’observé CRM l’emporte ; le déclaré est signalé. */
  resolution: 'keep_observed_crm';
  message: string;
}

export interface BomayeCrmBridgeResult {
  /**
   * Signaux réellement dérivés uniquement.
   * Champs absents = non disponibles (jamais forcés à 0 sauf clientCount observé à 0).
   */
  signals: Partial<BomayeAdvisorSignals>;
  fieldOrigins: Partial<Record<string, 'observed_crm'>>;
  facts: string[];
  limits: string[];
  insufficientForTrends: boolean;
  miOpportunityRuleIds: MiOpportunityRuleId[];
  dataQuality: MiOrgInsights['dataQuality'];
}

export interface BomayeMergedSignals {
  signals: BomayeAdvisorSignals;
  fieldOrigins: Partial<Record<string, BomayeDataOrigin>>;
  conflicts: BomayeSignalConflict[];
  crmFacts: string[];
  crmLimits: string[];
  miOpportunityRuleIds: MiOpportunityRuleId[];
}

const NUMERIC_CONFLICT_FIELDS: BomayeBridgeableField[] = [
  'visitsChangePct',
  'revenueChangePct',
  'clientContactCount',
  'consideringGeneralPriceCutPct',
  'deliverySharePct',
  'netMarginPct',
  'repeatRate60dPct',
  'avgReviewScore',
  'foodCostPct',
];

function nearlyEqual(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Dérive les signaux Bomaye depuis le snapshot MI/CRM.
 * P2.3 : part livraison si channelMix.deliverySharePct calculable.
 * Ne calcule toujours pas Food Cost, marge, ROI, note avis.
 */
export function deriveBomayeSignalsFromCrm(insights: MiOrgInsights): BomayeCrmBridgeResult {
  const facts: string[] = [];
  const limits: string[] = [...insights.limits];
  const fieldOrigins: Partial<Record<string, 'observed_crm'>> = {};
  const signals: Partial<BomayeAdvisorSignals> = {
    restaurantName: insights.restaurantName,
  };
  fieldOrigins.restaurantName = 'observed_crm';

  // clientCount est toujours un entier observé (0 = org vide, pas « manquant »).
  signals.clientContactCount = insights.clientCount;
  fieldOrigins.clientContactCount = 'observed_crm';
  facts.push(
    `Contacts / clients CRM = ${insights.clientCount} (origine: observed_crm, période ${insights.period.from} → ${insights.period.to})`
  );

  if (insights.clientCount === 0) {
    signals.hasCrmOrLoyalty = false;
    fieldOrigins.hasCrmOrLoyalty = 'observed_crm';
    facts.push('Aucune base clients CRM (clientCount=0, observed_crm).');
  } else {
    signals.hasCrmOrLoyalty = true;
    fieldOrigins.hasCrmOrLoyalty = 'observed_crm';
  }

  const miOpportunityRuleIds = insights.opportunities.map((o) => o.ruleId);
  const insufficientForTrends =
    insights.dataQuality === 'insufficient' || insights.trends === null;

  if (insights.dataQuality === 'insufficient') {
    limits.push(
      'dataQuality=insufficient — tendances CA/visites non dérivées pour Bomaye (pas de zéro inventé).'
    );
  } else if (!insights.trends) {
    limits.push('trends=null — variation CA/visites indisponible pour Bomaye.');
  } else {
    const { revenue, visits } = insights.trends;
    facts.push(insights.trends.comparisonNote);

    // changePct null si période précédente = 0 (percentChange) — ne pas substituer 0.
    if (revenue.changePct !== null && revenue.changePct !== undefined) {
      signals.revenueChangePct = revenue.changePct;
      fieldOrigins.revenueChangePct = 'observed_crm';
      facts.push(
        `Variation CA = ${revenue.changePct} % (current=${Math.round(revenue.current)}, previous=${Math.round(revenue.previous)}, significant=${revenue.significant}, observed_crm)`
      );
    } else {
      limits.push(
        'Variation CA non calculable (changePct null — souvent previous=0) ; non remplacée par 0.'
      );
    }

    if (visits.changePct !== null && visits.changePct !== undefined) {
      signals.visitsChangePct = visits.changePct;
      fieldOrigins.visitsChangePct = 'observed_crm';
      facts.push(
        `Variation visites = ${visits.changePct} % (current=${visits.current}, previous=${visits.previous}, significant=${visits.significant}, observed_crm)`
      );
    } else {
      limits.push(
        'Variation visites non calculable (changePct null) ; non remplacée par 0.'
      );
    }

    if (revenue.significant && revenue.changePct !== null && revenue.changePct < 0) {
      facts.push(
        `Signal MI : baisse CA significative (seuil tendances MI, rule opportunities éventuelle).`
      );
    }
    if (visits.significant && visits.changePct !== null && visits.changePct < 0) {
      facts.push(`Signal MI : baisse visites significative (seuil tendances MI).`);
    }
  }

  for (const op of insights.opportunities) {
    facts.push(
      `Opportunité MI ${op.ruleId} [${op.priority}] — ${op.detectionRule}`
    );
  }

  // —— P2.3 : part livraison depuis channelMix (order_type) ——
  const mix = insights.channelMix;
  if (mix && mix.deliverySharePct !== null && mix.deliverySharePct !== undefined) {
    signals.deliverySharePct = mix.deliverySharePct;
    fieldOrigins.deliverySharePct = 'observed_crm';
    facts.push(
      `Part livraison = ${mix.deliverySharePct} % (CA livraison ${Math.round(mix.deliveryRevenue)} / CA période ${Math.round(mix.periodRevenue)}, couverture order_type ${mix.coveragePct ?? '?'} %, observed_crm)`
    );
  } else if (mix) {
    limits.push(
      ...mix.limitations,
      'P2.3 : part livraison non publiée (deliverySharePct null — jamais forcée à 0 %).'
    );
  } else {
    limits.push(
      'P2.3 : channelMix absent — part livraison non dérivée (jamais forcée à 0 %).'
    );
  }

  // —— P2.4 : avis clients ——
  const reviews = insights.reviewsInsight;
  if (reviews && reviews.averageRating !== null && reviews.averageRating !== undefined) {
    signals.avgReviewScore = reviews.averageRating;
    fieldOrigins.avgReviewScore = 'observed_crm';
    const completeness =
      reviews.sampleComplete === true
        ? 'échantillon complet'
        : reviews.sampleComplete === false
          ? 'échantillon tronqué (non exhaustif)'
          : 'complétude incertaine (non exhaustif)';
    facts.push(
      `Note avis moyenne = ${reviews.averageRating}/5 sur ${reviews.ratedCount} avis notés (période dashboard ${reviews.period.from} → ${reviews.period.to}, volume période=${reviews.periodReviewCount}, ${completeness}, observed_crm)`
    );
    if (reviews.sampleComplete !== true) {
      limits.push(
        'P2.4 : moyenne avis calculée sur échantillon non prouvé exhaustif — ne pas la présenter comme couverture totale.'
      );
    }
    if (reviews.reviewTrendDown === true) {
      signals.reviewTrendDown = true;
      fieldOrigins.reviewTrendDown = 'observed_crm';
      facts.push(
        `Tendance avis = baisse (delta ${reviews.averageDelta ?? '?'} ; précédent=${reviews.previousAverageRating}/5 sur ${reviews.previousRatedCount} notes, observed_crm)`
      );
    } else if (reviews.trend === 'up' || reviews.trend === 'flat') {
      signals.reviewTrendDown = false;
      fieldOrigins.reviewTrendDown = 'observed_crm';
      facts.push(
        `Tendance avis = ${reviews.trend} (delta ${reviews.averageDelta ?? 0}, observed_crm) — pas une cause produit démontrée.`
      );
    } else {
      limits.push(
        'P2.4 : tendance avis non publiée (volume daté insuffisant) — reviewTrendDown non forcé.'
      );
    }
  } else if (reviews) {
    limits.push(
      ...reviews.limitations.filter((l) => !limits.includes(l)),
      'P2.4 : note moyenne avis non publiée (aucune note valide sur la période — jamais forcée à 0).'
    );
  } else {
    limits.push(
      'P2.4 : reviewsInsight absent — note avis non dérivée (jamais forcée à 0).'
    );
  }

  // —— P2.5 : récence / repeat rate ——
  const recency = insights.recencyLoyalty;
  if (recency && recency.repeatRate60dPct !== null && recency.repeatRate60dPct !== undefined) {
    signals.repeatRate60dPct = recency.repeatRate60dPct;
    fieldOrigins.repeatRate60dPct = 'observed_crm';
    facts.push(
      `Repeat rate 60 j = ${recency.repeatRate60dPct} % (méthode=${recency.repeatRateMethod}, cohort=${recency.repeatRateCohortSize}, répétiteurs=${recency.repeatRateRepeaters}, observed_crm)`
    );
    facts.push(
      `Autrefois réguliers inactifs = ${recency.formerlyRegularInactiveCount} ; at_risk = ${recency.atRiskCount} ; actifs récents (<${recency.inactiveThresholdDays} j) = ${recency.recentActiveCount} (inactif ≠ perdu, observed_crm)`
    );
    if (recency.frequencyCoolingCount !== null) {
      facts.push(
        `Clients en refroidissement de fréquence (J-60…J-30 denser que J-30…0) = ${recency.frequencyCoolingCount} (observed_crm)`
      );
    }
  } else if (recency) {
    limits.push(
      ...recency.limitations.filter((l) => !limits.includes(l)).slice(0, 4),
      'P2.5 : repeatRate60dPct non publié (cohort insuffisante) — jamais forcé à 0 %.'
    );
  } else {
    limits.push(
      'P2.5 : recencyLoyalty absent — repeat rate non dérivé (jamais forcé à 0 %).'
    );
  }

  // —— P2.6 : activité campagnes (faits CRM, pas de ROI Bomaye inventé) ——
  const camps = insights.campaignActivity;
  if (camps) {
    facts.push(
      `Campagnes période = ${camps.campaignsInPeriod} (draft/ready/scheduled=${camps.draftOrReadyCount}, completed=${camps.completedCount}, failed=${camps.failedCampaignCount}, observed_crm)`
    );
    facts.push(
      `Envois période = ${camps.sendsInPeriod} (pending=${camps.pendingCount}, sent=${camps.sentCount}, failed=${camps.failedCount}, observed_crm)`
    );
    if (camps.markedSentRatePct !== null && camps.markedSentRatePct !== undefined) {
      facts.push(
        `Taux marquage sent CRM = ${camps.markedSentRatePct} % (sent/(sent+failed), pas un delivery WhatsApp, observed_crm)`
      );
    } else {
      limits.push(
        'P2.6 : taux de marquage sent non publié (volume sent+failed insuffisant) — jamais forcé à 0 %.'
      );
    }
    if (camps.pendingSharePct !== null && camps.pendingSharePct >= 50 && camps.sendsInPeriod >= 3) {
      facts.push(
        `Part pending élevée = ${camps.pendingSharePct} % des envois période — file d’attente à traiter manuellement (observed_crm)`
      );
    }
    limits.push(
      ...camps.limitations.filter((l) => !limits.includes(l)).slice(0, 3)
    );
  } else {
    limits.push(
      'P2.6 : campaignActivity absent — stats campagnes non dérivées (ROI/opens non inventés).'
    );
  }

  // Food Cost / marge / ROI restent hors périmètre CRM observationnel.
  limits.push(
    'Food Cost, marge nette et ROI campagne non dérivés (données absentes du CRM).'
  );

  return {
    signals,
    fieldOrigins,
    facts,
    limits,
    insufficientForTrends,
    miOpportunityRuleIds,
    dataQuality: insights.dataQuality,
  };
}

/**
 * Fusionne signaux CRM observés et déclarés (message / overrides tests).
 * Règle : en cas de contradiction numérique, conserve observed_crm et journalise le conflit.
 */
export function mergeBomayeSignalSources(input: {
  crm: BomayeCrmBridgeResult;
  declared: BomayeAdvisorSignals;
}): BomayeMergedSignals {
  const { crm, declared } = input;
  const conflicts: BomayeSignalConflict[] = [];
  const fieldOrigins: Partial<Record<string, BomayeDataOrigin>> = {
    ...Object.fromEntries(
      Object.keys(declared).map((k) => [k, declared.dataOrigin])
    ),
  };

  const merged: BomayeAdvisorSignals = {
    ...declared,
    restaurantName: crm.signals.restaurantName ?? declared.restaurantName,
  };

  // Appliquer d’abord les champs CRM (observés).
  for (const [key, value] of Object.entries(crm.signals) as Array<
    [keyof BomayeAdvisorSignals, BomayeAdvisorSignals[keyof BomayeAdvisorSignals]]
  >) {
    if (value === undefined) continue;
    if (key === 'dataOrigin') continue;

    const declaredVal = declared[key];
    const isBridgeable = NUMERIC_CONFLICT_FIELDS.includes(key as BomayeBridgeableField);

    if (
      isBridgeable &&
      declaredVal !== null &&
      declaredVal !== undefined &&
      value !== null &&
      value !== undefined &&
      typeof declaredVal === 'number' &&
      typeof value === 'number' &&
      !nearlyEqual(declaredVal, value)
    ) {
      conflicts.push({
        field: key as BomayeBridgeableField,
        observedValue: value,
        declaredValue: declaredVal,
        resolution: 'keep_observed_crm',
        message: `Divergence sur ${key} : déclaré=${declaredVal}, observé CRM=${value} — conservation observed_crm.`,
      });
      (merged as Record<string, unknown>)[key] = value;
      fieldOrigins[key] = 'observed_crm';
    } else {
      (merged as Record<string, unknown>)[key] = value;
      fieldOrigins[key] = 'observed_crm';
    }
  }

  // Champs uniquement déclarés (non fournis par CRM) : conserver declared.
  for (const key of NUMERIC_CONFLICT_FIELDS) {
    if (crm.signals[key] !== undefined) continue;
    const d = declared[key];
    if (d !== null && d !== undefined) {
      fieldOrigins[key] = declared.dataOrigin;
    }
  }

  // dataOrigin global : observed_crm dès qu’au moins un champ CRM utile est présent.
  const hasCrmFields = Object.keys(crm.fieldOrigins).length > 0;
  merged.dataOrigin = hasCrmFields ? 'observed_crm' : declared.dataOrigin;

  // Ne jamais inventer foodCost / delivery / marge depuis le pont.
  // (crm.signals ne les pose pas ; declared peut les avoir — origins user_declared.)

  return {
    signals: merged,
    fieldOrigins,
    conflicts,
    crmFacts: crm.facts,
    crmLimits: crm.limits,
    miOpportunityRuleIds: crm.miOpportunityRuleIds,
  };
}
