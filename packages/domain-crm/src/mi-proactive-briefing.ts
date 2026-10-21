/**
 * MI P2.2 — Briefing proactif unifié.
 * Agrège tendances, opportunités, rétention et Bomaye (P2.1) sans inventer de chiffres.
 * Aucun envoi / campagne réelle.
 */
import type { MiOrgInsights } from './mi-tools';
import type { MiOpportunity } from './mi-opportunities';
import type { MiRetentionStrategy } from './mi-customer-intelligence';
import {
  deriveBomayeSignalsFromCrm,
  evaluateBomayeAdvisor,
  type BomayeAdvisorResult,
  type BomayeDataOrigin,
} from './knowledge';
import { MI_REVIEWS_TREND_MIN_RATED } from './mi-reviews';

export type MiBriefingItemKind =
  | 'fact'
  | 'interpretation'
  | 'hypothesis'
  | 'missing_data'
  | 'recommendation';

export type MiBriefingConfidence = 'low' | 'medium';

export type MiBriefingFamilyKey =
  | 'insufficient_data'
  | 'activity_drop'
  | 'activity_rise'
  | 'inactive_reconquest'
  | 'at_risk'
  | 'frequency_cooling'
  | 'new_clients_drop'
  | 'empty_contacts'
  | 'price_discipline'
  | 'reviews_quality'
  | 'retention_other'
  | 'campaign_activity'
  | 'campaign_draft_hint'
  | 'bomaye_other';

export interface MiProactiveBriefingItem {
  id: string;
  kind: MiBriefingItemKind;
  title: string;
  evidence: string[];
  interpretation: string;
  confidence: MiBriefingConfidence;
  recommendedActions: string[];
  successMetric: string;
  source: string;
  dataOrigin: BomayeDataOrigin | 'derived_rule';
  limitations: string[];
  priority: 'high' | 'medium' | 'low';
  rankScore: number;
  familyKey: MiBriefingFamilyKey;
}

export interface MiProactiveBriefing {
  period: Pick<MiOrgInsights['period'], 'code' | 'label' | 'from' | 'to'>;
  dataQuality: MiOrgInsights['dataQuality'];
  status: 'ready' | 'insufficient' | 'empty';
  summary: string;
  items: MiProactiveBriefingItem[];
  missingForBetterBriefing: string[];
  limitations: string[];
  executionNote: string;
}

const EXECUTION_NOTE =
  'Briefing consultatif uniquement — aucune campagne envoyée, aucun WhatsApp réel, aucune action irréversible.';

const NO_IMPACT_FINANCIAL =
  'Impact financier (€ / ROI / marge) non calculable avec les données CRM actuelles — non inventé.';

function priorityRank(p: 'high' | 'medium' | 'low'): number {
  if (p === 'high') return 300;
  if (p === 'medium') return 200;
  return 100;
}

function familyFromOpportunity(ruleId: MiOpportunity['ruleId']): MiBriefingFamilyKey {
  if (ruleId === 'revenue_drop_significant' || ruleId === 'visits_drop_significant') {
    return 'activity_drop';
  }
  if (ruleId === 'revenue_rise_significant') return 'activity_rise';
  if (ruleId === 'inactive_loyal_reconquest') return 'inactive_reconquest';
  if (ruleId === 'at_risk_segment_size') return 'at_risk';
  if (ruleId === 'new_clients_drop') return 'new_clients_drop';
  return 'bomaye_other';
}

function familyFromRetention(ruleId: MiRetentionStrategy['ruleId']): MiBriefingFamilyKey {
  if (ruleId === 'reactivate_inactive') return 'inactive_reconquest';
  if (ruleId === 'nurture_at_risk') return 'at_risk';
  return 'retention_other';
}

function familyFromBomaye(ruleId: string): MiBriefingFamilyKey {
  if (ruleId === 'CASE-PRICE-CUT') return 'price_discipline';
  if (ruleId === 'CASE-NO-CONTACTS') return 'empty_contacts';
  if (ruleId === 'CASE-INSUFFICIENT-FINANCE') return 'insufficient_data';
  if (ruleId === 'CASE-NEGATIVE-REVIEWS' || ruleId === 'REGLE-DEC-02') {
    return 'reviews_quality';
  }
  if (ruleId === 'REGLE-DEC-01') return 'bomaye_other';
  if (ruleId.startsWith('REGLE-DEC') || ruleId.startsWith('CASE-')) return 'bomaye_other';
  return 'bomaye_other';
}

function campaignActivityFactItems(insights: MiOrgInsights): MiProactiveBriefingItem[] {
  const c = insights.campaignActivity;
  if (!c) {
    return [
      {
        id: 'brief-campaigns-unavailable',
        kind: 'missing_data',
        title: 'Stats campagnes indisponibles',
        evidence: ['campaignActivity=null'],
        interpretation:
          'Lecture campagnes/envois en échec ou absente — aucun ROI ni taux d’ouverture inventé.',
        confidence: 'low',
        recommendedActions: [
          'Vérifier le module Campagnes et les permissions org',
          'Réessayer /api/mi/insights',
        ],
        successMetric: 'campaignActivity non null sur insights.',
        source: 'mi-campaign-activity:load',
        dataOrigin: 'observed_crm',
        limitations: ['Aucun envoi WhatsApp depuis ce briefing.'],
        priority: 'low',
        rankScore: 140,
        familyKey: 'campaign_activity',
      },
    ];
  }

  if (c.campaignsInPeriod === 0 && c.sendsInPeriod === 0) {
    return [
      {
        id: 'brief-campaigns-empty-period',
        kind: 'missing_data',
        title: 'Aucune activité campagne sur la période',
        evidence: [
          `période ${c.period.from} → ${c.period.to}`,
          `échantillon campagnes=${c.sampleCampaignsLoaded}, envois=${c.sampleSendsLoaded}`,
          ...c.limitations.slice(0, 2),
        ],
        interpretation:
          'Pas de campagne créée ni d’envoi daté sur la fenêtre — ce n’est pas un échec marketing mesuré.',
        confidence: 'low',
        recommendedActions: [
          'Créer / planifier une campagne via le module Campagnes si besoin (hors MI)',
          'Utiliser les brouillons MI uniquement comme suggestion consultative',
        ],
        successMetric: 'campaignsInPeriod ou sendsInPeriod > 0 sur la même période.',
        source: 'mi-campaign-activity:compute',
        dataOrigin: 'observed_crm',
        limitations: [
          ...c.limitations.slice(0, 3),
          'Aucune création/envoi automatique depuis MI.',
        ],
        priority: 'low',
        rankScore: 135,
        familyKey: 'campaign_activity',
      },
    ];
  }

  const out: MiProactiveBriefingItem[] = [
    {
      id: 'brief-campaign-activity-fact',
      kind: 'fact',
      title: `Activité campagnes : ${c.campaignsInPeriod} campagne(s), ${c.sendsInPeriod} envoi(s)`,
      evidence: [
        `période ${c.period.from} → ${c.period.to} (${c.period.label})`,
        `pending=${c.pendingCount}, sent=${c.sentCount}, failed=${c.failedCount}`,
        c.markedSentRatePct != null
          ? `taux marquage sent=${c.markedSentRatePct} %`
          : 'taux marquage sent non publié',
        c.pendingSharePct != null ? `part pending=${c.pendingSharePct} %` : 'part pending n/a',
        `target_count cumulé=${c.plannedTargetSum}`,
        'origine: observed_crm',
      ],
      interpretation:
        'Volumes CRM observés. sent ≠ message lu ; pas d’attribution CA / ROI possible avec le schéma actuel.',
      confidence: c.sendsInPeriod >= 5 ? 'medium' : 'low',
      recommendedActions: [
        'Traiter la file pending dans Campagnes / Relances (manuel)',
        'Ne pas conclure à un ROI sans données de conversion (absentes)',
      ],
      successMetric:
        'Réduire pendingSharePct et suivre markedSentRatePct — sans inventer un impact CA.',
      source: 'mi-campaign-activity:compute',
      dataOrigin: 'observed_crm',
      limitations: [...c.limitations.slice(0, 4)],
      priority:
        c.pendingSharePct != null && c.pendingSharePct >= 50 && c.sendsInPeriod >= 3
          ? 'medium'
          : 'low',
      rankScore:
        c.pendingSharePct != null && c.pendingSharePct >= 50 ? 220 : 145,
      familyKey: 'campaign_activity',
    },
  ];

  if (c.failedCount >= 3 || c.failedCampaignCount >= 1) {
    out.push({
      id: 'brief-campaign-failures',
      kind: 'recommendation',
      title: 'Échecs campagne / envois à investiguer',
      evidence: [
        `envois failed=${c.failedCount}`,
        `campagnes failed=${c.failedCampaignCount}`,
        'origine: observed_crm',
      ],
      interpretation:
        'Des échecs sont enregistrés en CRM — cause technique non déduite automatiquement.',
      confidence: 'low',
      recommendedActions: [
        'Inspecter les envois failed dans le module Campagnes',
        'Vérifier numéros / opt-in avant nouvel essai manuel',
      ],
      successMetric: 'Baisser failedCount sur la période suivante.',
      source: 'mi-campaign-activity:failures',
      dataOrigin: 'observed_crm',
      limitations: ['Pas de diagnostic cause automatique.', 'Aucun renvoi auto.'],
      priority: 'medium',
      rankScore: 235,
      familyKey: 'campaign_activity',
    });
  }

  return out;
}

function recencyFactItems(insights: MiOrgInsights): MiProactiveBriefingItem[] {
  const r = insights.recencyLoyalty;
  if (!r) {
    return [
      {
        id: 'brief-recency-unavailable',
        kind: 'missing_data',
        title: 'Récence / fidélisation indisponible',
        evidence: ['recencyLoyalty=null'],
        interpretation:
          'Impossible de qualifier inactifs / repeat rate — aucun taux inventé.',
        confidence: 'low',
        recommendedActions: [
          'Vérifier la lecture clients / client_visits',
          'Réessayer /api/mi/insights',
        ],
        successMetric: 'recencyLoyalty non null sur insights.',
        source: 'mi-recency-loyalty:load',
        dataOrigin: 'observed_crm',
        limitations: ['Aucun envoi de relance depuis ce briefing.'],
        priority: 'medium',
        rankScore: 155,
        familyKey: 'retention_other',
      },
    ];
  }

  const out: MiProactiveBriefingItem[] = [];

  if (r.formerlyRegularInactiveCount >= 1) {
    out.push({
      id: 'brief-formerly-regular-inactive',
      kind: 'recommendation',
      title: `${r.formerlyRegularInactiveCount} client(s) autrefois régulier(s) sans visite récente`,
      evidence: [
        `formerlyRegularInactiveCount = ${r.formerlyRegularInactiveCount}`,
        `seuil inactivité CRM = ${r.inactiveThresholdDays} j`,
        `médiane récence = ${r.medianRecencyDays ?? 'n/a'} j`,
        'origine: observed_crm',
      ],
      interpretation:
        'Clients avec historique (≥ 3 visites) sans passage récent. Inactif ≠ perdu — pas de conclusion commerciale définitive.',
      confidence: r.formerlyRegularInactiveCount >= 5 ? 'medium' : 'low',
      recommendedActions: [
        'Préparer une relance manuelle ciblée (plus gros dépensiers) hors MI',
        'Vérifier le module Relances / Campagnes avant tout envoi',
      ],
      successMetric:
        'Baisser formerlyRegularInactiveCount ou voir des retours visités (pas de ROI inventé).',
      source: 'mi-recency-loyalty:formerlyRegularInactive',
      dataOrigin: 'observed_crm',
      limitations: [
        ...r.limitations.slice(0, 3),
        'Aucun WhatsApp automatique depuis ce signal.',
      ],
      priority: r.formerlyRegularInactiveCount >= 10 ? 'high' : 'medium',
      rankScore: 265,
      familyKey: 'inactive_reconquest',
    });
  }

  if (r.atRiskCount >= 1) {
    out.push({
      id: 'brief-at-risk-recency',
      kind: 'fact',
      title: `${r.atRiskCount} client(s) at_risk (récence / historique faible)`,
      evidence: [
        `atRiskCount = ${r.atRiskCount}`,
        `actifs récents = ${r.recentActiveCount}`,
        'origine: observed_crm',
      ],
      interpretation:
        'Segment CRM at_risk (règles visit_count / last_visit). Pas une prédiction de churn.',
      confidence: 'low',
      recommendedActions: [
        'Surveiller sans campagne agressive tant que le diagnostic produit/avis n’est pas clair',
      ],
      successMetric: 'Réduire atRiskCount via passages enregistrés.',
      source: 'mi-recency-loyalty:atRisk',
      dataOrigin: 'observed_crm',
      limitations: [...r.limitations.slice(0, 2)],
      priority: r.atRiskCount >= 10 ? 'high' : 'medium',
      rankScore: 240,
      familyKey: 'at_risk',
    });
  }

  if (r.frequencyCoolingCount !== null && r.frequencyCoolingCount >= 1) {
    out.push({
      id: 'brief-frequency-cooling',
      kind: 'interpretation',
      title: `${r.frequencyCoolingCount} client(s) avec fréquence apparente en baisse`,
      evidence: [
        `frequencyCoolingCount = ${r.frequencyCoolingCount}`,
        `échantillon visites = ${r.sampleVisitsLoaded}`,
        'fenêtres J-60…J-30 vs J-30…J-0',
        'origine: observed_crm',
      ],
      interpretation:
        'Moins de passages récents qu’auparavant sur 30 j — hypothèse de ralentissement, pas une preuve de désengagement définitif.',
      confidence: 'low',
      recommendedActions: [
        'Inspecter quelques dossiers clients avant toute offre',
        'Ne pas envoyer de campagne de masse automatiquement',
      ],
      successMetric: 'Remontée des passages sur la fenêtre récente (comptage CRM).',
      source: 'mi-recency-loyalty:frequencyCooling',
      dataOrigin: 'observed_crm',
      limitations: [
        'Signal déterministe sur comptages de visites uniquement.',
        'Aucun message automatique.',
      ],
      priority: 'medium',
      rankScore: 230,
      familyKey: 'frequency_cooling',
    });
  }

  if (r.repeatRate60dPct === null) {
    out.push({
      id: 'brief-repeat-rate-missing',
      kind: 'missing_data',
      title: 'Repeat rate 60 j non publiable',
      evidence: [
        `cohort = ${r.repeatRateCohortSize}`,
        ...r.limitations.filter((l) => /Repeat rate/i.test(l)).slice(0, 2),
      ],
      interpretation:
        'Volume insuffisant pour un taux de retour fiable — non remplacé par 0 %.',
      confidence: 'low',
      recommendedActions: [
        'Enregistrer davantage de passages payés',
        'Élargir la base clients active',
      ],
      successMetric: `cohort ≥ seuil MI sur 60 j avec méthode visit_windows ou proxy.`,
      source: 'mi-recency-loyalty:repeatRate',
      dataOrigin: 'observed_crm',
      limitations: r.limitations.slice(0, 3),
      priority: 'low',
      rankScore: 130,
      familyKey: 'retention_other',
    });
  } else {
    out.push({
      id: 'brief-repeat-rate-fact',
      kind: 'fact',
      title: `Repeat rate 60 j = ${r.repeatRate60dPct} % (${r.repeatRateMethod})`,
      evidence: [
        `cohort = ${r.repeatRateCohortSize}`,
        `répétiteurs = ${r.repeatRateRepeaters}`,
        `méthode = ${r.repeatRateMethod}`,
        'origine: observed_crm',
      ],
      interpretation:
        r.repeatRateMethod === 'visit_windows'
          ? 'Part des clients actifs sur 60 j qui avaient aussi une visite sur la fenêtre précédente (60–120 j).'
          : 'Proxy lifetime (visit_count ≥ 2 parmi clients vus ≤ 60 j) — moins précis que visit_windows.',
      confidence: r.repeatRateMethod === 'visit_windows' ? 'medium' : 'low',
      recommendedActions: [
        'Si < seuil Bomaye 20 % : croiser avec avis (REGLE-DEC-02) avant campagne acquisition',
      ],
      successMetric: 'Suivre repeatRate60dPct sur les prochains snapshots insights.',
      source: 'mi-recency-loyalty:repeatRate',
      dataOrigin: 'observed_crm',
      limitations: r.limitations.slice(0, 3),
      priority: r.repeatRate60dPct < 20 ? 'high' : 'low',
      rankScore: r.repeatRate60dPct < 20 ? 275 : 125,
      familyKey: 'retention_other',
    });
  }

  return out;
}

function reviewFactItems(insights: MiOrgInsights): MiProactiveBriefingItem[] {
  const r = insights.reviewsInsight;
  if (!r) {
    return [
      {
        id: 'brief-reviews-unavailable',
        kind: 'missing_data',
        title: 'Avis clients indisponibles',
        evidence: ['reviewsInsight=null'],
        interpretation:
          'La lecture des avis a échoué ou n’a pas été chargée — aucune note inventée.',
        confidence: 'low',
        recommendedActions: [
          'Vérifier l’accès module Avis et les permissions org',
          'Réessayer le chargement insights MI',
        ],
        successMetric: 'reviewsInsight non null sur /api/mi/insights.',
        source: 'mi-reviews:load',
        dataOrigin: 'observed_crm',
        limitations: ['Pas de réponse automatique aux avis depuis ce briefing.'],
        priority: 'medium',
        rankScore: 150,
        familyKey: 'reviews_quality',
      },
    ];
  }

  if (r.averageRating === null) {
    return [
      {
        id: 'brief-reviews-missing',
        kind: 'missing_data',
        title: 'Pas de note moyenne avis publiable sur la période',
        evidence: [
          `volume période = ${r.periodReviewCount}`,
          `notes valides = ${r.ratedCount}`,
          `période ${r.period.from} → ${r.period.to}`,
          ...r.limitations.slice(0, 3),
        ],
        interpretation:
          'Absence d’avis (ou notes invalides) ≠ mauvaise note. Aucune moyenne inventée.',
        confidence: 'low',
        recommendedActions: [
          'Collecter des avis clients via le module Avis (sans envoi auto depuis MI)',
          'Élargir la période si le volume est trop faible',
        ],
        successMetric: 'ratedCount ≥ 1 et averageRating publiée sur la même période.',
        source: 'mi-reviews:computeMiReviewsInsight',
        dataOrigin: 'observed_crm',
        limitations: [
          ...r.limitations.slice(0, 4),
          'Pas d’analyse de cause produit à partir de l’absence d’avis.',
          'Aucune réponse / publication d’avis depuis ce briefing.',
        ],
        priority: 'medium',
        rankScore: 160,
        familyKey: 'reviews_quality',
      },
    ];
  }

  // Fait mesuré uniquement — CASE-NEGATIVE-REVIEWS / REGLE-DEC-02 via Bomaye si seuils.
  const trendLabel =
    r.trend === null
      ? 'tendance non publiée (données insuffisantes)'
      : `tendance ${r.trend}${r.averageDelta != null ? ` (Δ ${r.averageDelta})` : ''}`;

  const completenessLabel =
    r.sampleComplete === true
      ? 'échantillon complet'
      : r.sampleComplete === false
        ? `échantillon tronqué (${r.sampleSizeLoaded}/${r.totalMatchingInWindow ?? '?'} ; plafond ${r.sampleFetchLimit})`
        : `complétude incertaine (plafond ${r.sampleFetchLimit} ; total non confirmé)`;

  const exhaustiveOk = r.sampleComplete === true;
  const reviewConfidence: MiBriefingConfidence =
    exhaustiveOk && r.ratedCount >= 5 ? 'medium' : 'low';

  return [
    {
      id: 'brief-reviews-fact',
      kind: 'fact',
      title: `Note avis moyenne ${r.averageRating}/5 (${r.ratedCount} avis notés)`,
      evidence: [
        `Période dashboard ${r.period.from} → ${r.period.to} (${r.period.label}) — alignée tendances`,
        `Volume avis période = ${r.periodReviewCount}`,
        `Notes valides = ${r.ratedCount}`,
        `Commentaires non vides = ${r.withCommentCount}`,
        trendLabel,
        completenessLabel,
        `Sources = ${r.sources.length ? r.sources.join(', ') : 'n/a'}`,
        'origine: observed_crm',
      ],
      interpretation: exhaustiveOk
        ? 'Constat de réputation mesuré sur l’échantillon complet chargé. La note seule ne démontre pas la cause (cuisine, service, attente, etc.).'
        : 'Constat sur un échantillon potentiellement incomplet — ne pas présenter cette moyenne comme mesure exhaustive de tous les avis de la fenêtre. La note seule ne démontre pas la cause.',
      confidence: reviewConfidence,
      recommendedActions: [
        'Consulter les avis dans le module Avis (lecture humaine)',
        'Si note < seuil Bomaye 4.0 : prioriser audit ops avant acquisition (via règles Bomaye)',
      ],
      successMetric:
        'Suivre averageRating et ratedCount sur la même période après actions ops manuelles.',
      source: 'mi-reviews:computeMiReviewsInsight',
      dataOrigin: 'observed_crm',
      limitations: [
        ...r.limitations.slice(0, 5),
        'Aucune réponse automatique ni publication d’avis depuis MI.',
      ],
      priority: r.averageRating < 4 ? 'high' : 'low',
      rankScore: r.averageRating < 4 ? 270 : 120,
      familyKey: 'reviews_quality',
    },
  ];
}

function periodSlice(insights: MiOrgInsights) {
  return {
    code: insights.period.code,
    label: insights.period.label,
    from: insights.period.from,
    to: insights.period.to,
  };
}

function mergeIntoFamily(
  map: Map<MiBriefingFamilyKey, MiProactiveBriefingItem>,
  item: MiProactiveBriefingItem
): void {
  const existing = map.get(item.familyKey);
  if (!existing) {
    map.set(item.familyKey, item);
    return;
  }
  // Fusion : garder la priorité max, concaténer preuves/actions/sources sans inventer.
  const priority =
    priorityRank(item.priority) > priorityRank(existing.priority)
      ? item.priority
      : existing.priority;
  map.set(item.familyKey, {
    ...existing,
    priority,
    rankScore: Math.max(existing.rankScore, item.rankScore),
    title: priorityRank(item.priority) > priorityRank(existing.priority) ? item.title : existing.title,
    kind: item.kind === 'recommendation' || existing.kind === 'recommendation'
      ? 'recommendation'
      : existing.kind,
    evidence: Array.from(new Set([...existing.evidence, ...item.evidence])),
    interpretation:
      existing.interpretation === item.interpretation
        ? existing.interpretation
        : `${existing.interpretation} ${item.interpretation}`.trim(),
    recommendedActions: Array.from(
      new Set([...existing.recommendedActions, ...item.recommendedActions])
    ).slice(0, 8),
    limitations: Array.from(new Set([...existing.limitations, ...item.limitations])),
    source: `${existing.source} | ${item.source}`,
    confidence:
      existing.confidence === 'medium' || item.confidence === 'medium' ? 'medium' : 'low',
    successMetric: existing.successMetric || item.successMetric,
  });
}

function itemFromOpportunity(
  op: MiOpportunity,
  currency: string
): MiProactiveBriefingItem {
  void currency;
  return {
    id: `brief-opp-${op.ruleId}`,
    kind: 'recommendation',
    title: op.suggestedAction,
    evidence: [...op.facts],
    interpretation:
      'Signal détecté par règles MI déterministes. Variation ≠ cause démontrée.',
    confidence: 'medium',
    recommendedActions: [op.suggestedAction],
    successMetric: `Suivre le KPI concerné sur la période suivante (« ${op.period.label} »).`,
    source: `mi-opportunities:${op.ruleId}`,
    dataOrigin: 'observed_crm',
    limitations: [...op.limits, NO_IMPACT_FINANCIAL],
    priority: op.priority,
    rankScore: op.rankScore,
    familyKey: familyFromOpportunity(op.ruleId),
  };
}

function itemFromRetention(s: MiRetentionStrategy): MiProactiveBriefingItem {
  return {
    id: `brief-ret-${s.ruleId}`,
    kind: 'recommendation',
    title: s.marketingObjective,
    evidence: [...s.facts, `Effectif = ${s.headcount}`, `Critères : ${s.selectionCriteria}`],
    interpretation:
      'Stratégie de fidélisation basée sur segments CRM instantanés — pas une prédiction de conversion.',
    confidence: s.confidence,
    recommendedActions: [s.suggestedAction],
    successMetric: `Suivre le retour du segment « ${s.segmentKey} » (n=${s.headcount}) sur la prochaine période.`,
    source: `mi-retention:${s.ruleId}`,
    dataOrigin: 'observed_crm',
    limitations: [...s.limits, NO_IMPACT_FINANCIAL, 'Aucun envoi automatique.'],
    priority: s.priority,
    rankScore: s.rankScore,
    familyKey: familyFromRetention(s.ruleId),
  };
}

function itemsFromBomaye(advice: BomayeAdvisorResult): MiProactiveBriefingItem[] {
  return advice.fires.map((f) => ({
    id: `brief-bomaye-${f.ruleId}`,
    kind: 'recommendation' as const,
    title: f.recommendation,
    evidence: advice.observedFacts.filter((x) =>
      /observed_crm|Variation|Contacts|Opportunité MI|Part livraison|Note avis|Tendance avis|Repeat rate|Autrefois réguliers|refroidissement|Campagnes période|Envois période|Taux marquage|Part pending/i.test(
        x
      )
    ).slice(0, 6),
    interpretation: f.recommendation,
    confidence: f.priority === 'info' ? ('low' as const) : ('medium' as const),
    recommendedActions: [...f.actions],
    successMetric:
      'Réévaluer les mêmes indicateurs CRM après action manuelle (pas de ROI inventé).',
    source: `bomaye:${f.ruleId}`,
    dataOrigin: advice.dataOrigin,
    limitations: [
      ...f.contraindications.map((c) => `Contre-indication : ${c}`),
      ...f.missingInputs.map((m) => `Donnée manquante : ${m}`),
      NO_IMPACT_FINANCIAL,
      'Seuils Bomaye = source documentée, pas une loi universelle.',
    ],
    priority: f.priority === 'critical' || f.priority === 'high' ? 'high' : f.priority === 'info' ? 'low' : 'medium',
    rankScore: priorityRank(
      f.priority === 'critical' || f.priority === 'high'
        ? 'high'
        : f.priority === 'info'
          ? 'low'
          : 'medium'
    ) + 10,
    familyKey: familyFromBomaye(f.ruleId),
  }));
}

function trendFactItems(insights: MiOrgInsights): MiProactiveBriefingItem[] {
  const t = insights.trends;
  if (!t) return [];
  const out: MiProactiveBriefingItem[] = [];
  const periodLabel = `${insights.period.from} → ${insights.period.to}`;

  if (t.revenue.changePct !== null && t.revenue.significant && t.revenue.changePct < 0) {
    out.push({
      id: 'brief-fact-revenue-drop',
      kind: 'fact',
      title: `Baisse de CA observée (${t.revenue.changePct} %)`,
      evidence: [
        `CA période = ${Math.round(t.revenue.current)} ${insights.currency}`,
        `CA précédente = ${Math.round(t.revenue.previous)} ${insights.currency}`,
        `Variation = ${t.revenue.changePct} % (significant=${t.revenue.significant})`,
        `Période ${periodLabel}`,
        t.comparisonNote,
      ],
      interpretation:
        'Fait CRM (dashboard). N’établit pas à lui seul la cause (saison, stock, events non mesurés).',
      confidence: 'medium',
      recommendedActions: [],
      successMetric: 'Comparer le CA de la période suivante au même référentiel.',
      source: 'mi-trends:revenue',
      dataOrigin: 'observed_crm',
      limitations: [NO_IMPACT_FINANCIAL],
      priority: t.revenue.changePct <= -35 ? 'high' : 'medium',
      rankScore: 250,
      familyKey: 'activity_drop',
    });
  }

  if (t.visits.changePct !== null && t.visits.significant && t.visits.changePct < 0) {
    out.push({
      id: 'brief-fact-visits-drop',
      kind: 'fact',
      title: `Baisse de visites observée (${t.visits.changePct} %)`,
      evidence: [
        `Visites période = ${t.visits.current}`,
        `Visites précédente = ${t.visits.previous}`,
        `Variation = ${t.visits.changePct} %`,
        `Période ${periodLabel}`,
      ],
      interpretation: 'Fait CRM. Variation relative ≠ diagnostic causal.',
      confidence: 'medium',
      recommendedActions: [],
      successMetric: 'Suivre le volume de visites payées sur la période suivante.',
      source: 'mi-trends:visits',
      dataOrigin: 'observed_crm',
      limitations: [],
      priority: 'medium',
      rankScore: 240,
      familyKey: 'activity_drop',
    });
  }

  return out;
}

/** Snapshot MI sans le briefing lui-même (évite la récursion). */
export type MiBriefingSource = Omit<MiOrgInsights, 'proactiveBriefing'>;

/**
 * Construit le briefing proactif à partir du snapshot MI déjà chargé.
 * Appelable sans question utilisateur.
 */
export function buildMiProactiveBriefing(insights: MiBriefingSource): MiProactiveBriefing {
  const period = periodSlice(insights);
  const limitations: string[] = [...insights.limits];
  const missingForBetterBriefing: string[] = [];
  const byFamily = new Map<MiBriefingFamilyKey, MiProactiveBriefingItem>();

  limitations.push(NO_IMPACT_FINANCIAL);
  limitations.push(
    'Food Cost, marge nette et ROI non inclus dans ce briefing (données absentes du CRM).'
  );
  if (insights.measurementWindows?.length) {
    for (const w of insights.measurementWindows) {
      if (!w.alignedWithDashboard) {
        limitations.push(
          `Fenêtre « ${w.label} » (${w.from} → ${w.to}) : distincte de la période dashboard — ${w.definition.slice(0, 120)}${w.definition.length > 120 ? '…' : ''}`
        );
      }
    }
  }
  if (
    !insights.channelMix ||
    insights.channelMix.deliverySharePct === null ||
    insights.channelMix.deliverySharePct === undefined
  ) {
    limitations.push(
      'Part livraison non publiée dans ce briefing (order_type manquant ou CA insuffisant — jamais forcée à 0 %).'
    );
  }
  if (!insights.reviewsInsight || insights.reviewsInsight.averageRating === null) {
    limitations.push(
      'Note avis moyenne non publiée (avis absents ou notes invalides — jamais forcée à 0).'
    );
  }

  if (insights.dataQuality === 'insufficient') {
    missingForBetterBriefing.push(
      'Commandes payées sur la période',
      'Base clients non vide',
      'Élargir la période si volume insuffisant'
    );
    return {
      period,
      dataQuality: insights.dataQuality,
      status: 'insufficient',
      summary:
        'Données insuffisantes pour un briefing proactif fiable — aucun signal inventé.',
      items: [
        {
          id: 'brief-insufficient',
          kind: 'missing_data',
          title: 'Briefing impossible : données CRM insuffisantes',
          evidence: insights.limits.length
            ? [...insights.limits]
            : ['dataQuality=insufficient'],
          interpretation:
            'Le copilote refuse de produire des opportunités fictives tant que le volume CRM est insuffisant.',
          confidence: 'low',
          recommendedActions: [
            'Enregistrer des commandes payées',
            'Vérifier la période sélectionnée',
            'Collecter des contacts clients si la base est vide',
          ],
          successMetric: 'dataQuality passe à partial ou ok sur le même endpoint insights.',
          source: 'mi-tools:assessMiDataQuality',
          dataOrigin: 'observed_crm',
          limitations: [...insights.limits],
          priority: 'high',
          rankScore: 400,
          familyKey: 'insufficient_data',
        },
      ],
      missingForBetterBriefing,
      limitations,
      executionNote: EXECUTION_NOTE,
    };
  }

  // 1) Faits tendances
  for (const item of trendFactItems(insights)) {
    mergeIntoFamily(byFamily, item);
  }

  // 1b) Avis clients (P2.4) — faits / missing avant Bomaye pour ancrer la famille reviews_quality
  for (const item of reviewFactItems(insights)) {
    mergeIntoFamily(byFamily, item);
  }

  // 1c) Récence / fidélisation (P2.5)
  for (const item of recencyFactItems(insights)) {
    mergeIntoFamily(byFamily, item);
  }

  // 1d) Activité campagnes (P2.6) — distinct des brouillons campaign_draft_hint
  for (const item of campaignActivityFactItems(insights)) {
    mergeIntoFamily(byFamily, item);
  }

  // 2) Opportunités MI
  for (const op of insights.opportunities) {
    mergeIntoFamily(byFamily, itemFromOpportunity(op, insights.currency));
  }

  // 3) Rétention (dédup avec inactive/at_risk)
  for (const s of insights.retentionStrategies) {
    mergeIntoFamily(byFamily, itemFromRetention(s));
  }

  // 4) Bomaye depuis CRM uniquement (P2.1) — pas de message utilisateur
  const crm = deriveBomayeSignalsFromCrm(insights);
  const bomayeSignals = {
    dataOrigin: 'observed_crm' as const,
    ...crm.signals,
  };
  const advice = evaluateBomayeAdvisor(bomayeSignals, {
    fieldOrigins: crm.fieldOrigins,
    crmFacts: crm.facts,
    crmLimits: crm.limits,
    miOpportunityRuleIds: crm.miOpportunityRuleIds,
  });
  for (const item of itemsFromBomaye(advice)) {
    mergeIntoFamily(byFamily, item);
  }

  // 5) Base contacts vide (si pas déjà via Bomaye)
  if (insights.clientCount === 0 && !byFamily.has('empty_contacts')) {
    mergeIntoFamily(byFamily, {
      id: 'brief-empty-contacts',
      kind: 'recommendation',
      title: 'Aucune base de contacts CRM',
      evidence: [`clientCount = 0 (observed_crm)`],
      interpretation: 'Sans canal de recontact, la réactivation marketing est limitée.',
      confidence: 'medium',
      recommendedActions: [
        'Mettre en place une collecte consentie first-party',
        'Former l’équipe caisse à l’enrôlement',
      ],
      successMetric: 'clientCount > 0 et contacts exploitables.',
      source: 'mi-tools:clientCount',
      dataOrigin: 'observed_crm',
      limitations: [],
      priority: 'high',
      rankScore: 280,
      familyKey: 'empty_contacts',
    });
  }

  // 6) Hint campagnes (brouillons seulement) — une seule famille, sans ROI
  const topCampaign = insights.campaignProposals[0];
  if (topCampaign && topCampaign.audienceHeadcount > 0) {
    mergeIntoFamily(byFamily, {
      id: `brief-campaign-${topCampaign.objectiveId}`,
      kind: 'recommendation',
      title: `Brouillon campagne suggéré : ${topCampaign.suggestedName}`,
      evidence: [
        ...topCampaign.analyticalJustification.slice(0, 4),
        `Audience CRM = ${topCampaign.audienceHeadcount}`,
      ],
      interpretation:
        'Proposition déterministe MI P3 — brouillon non persisté, aucun envoi.',
      confidence: 'low',
      recommendedActions: [
        'Réviser le message brouillon dans MI',
        'Créer la campagne via le module Campagnes si permission clients:write (hors MI)',
      ],
      successMetric:
        'Si campagne créée hors MI : suivre les envois réussis — pas de ROI inventé ici.',
      source: `mi-campaign:${topCampaign.objectiveId}`,
      dataOrigin: 'observed_crm',
      limitations: [...topCampaign.limits, 'Aucun envoi WhatsApp depuis ce briefing.'],
      priority: topCampaign.priority,
      rankScore: topCampaign.rankScore * 0.5,
      familyKey: 'campaign_draft_hint',
    });
  }

  if (insights.dataQuality === 'partial') {
    missingForBetterBriefing.push('Lignes visit_items complètes pour fiabiliser les top produits');
  }
  if (!insights.trends) {
    missingForBetterBriefing.push('Tendances CA/visites (KPIs période)');
  }
  missingForBetterBriefing.push(
    'Food Cost / coûts matières (non disponibles en CRM)'
  );
  if (
    !insights.channelMix ||
    insights.channelMix.deliverySharePct === null ||
    insights.channelMix.deliverySharePct === undefined
  ) {
    missingForBetterBriefing.push(
      'order_type renseigné sur les commandes (sur_place / a_emporter / livraison) pour publier la part livraison'
    );
  }
  if (!insights.reviewsInsight || insights.reviewsInsight.averageRating === null) {
    missingForBetterBriefing.push(
      'Avis clients notés (1–5) sur la période pour publier la note moyenne'
    );
  } else if (insights.reviewsInsight.trend === null) {
    missingForBetterBriefing.push(
      `Au moins ${MI_REVIEWS_TREND_MIN_RATED} avis notés sur la période courante et la précédente pour une tendance fiable`
    );
  }
  if (
    insights.reviewsInsight &&
    insights.reviewsInsight.withCommentCount === 0 &&
    insights.reviewsInsight.periodReviewCount > 0
  ) {
    missingForBetterBriefing.push(
      'Commentaires d’avis non vides (analyse thématique non supportée même s’ils sont présents)'
    );
  }
  if (!insights.recencyLoyalty || insights.recencyLoyalty.repeatRate60dPct === null) {
    missingForBetterBriefing.push(
      'Passages payés suffisants sur 60 j (+ fenêtre précédente) pour un repeat rate fiable'
    );
  }
  if (
    insights.recencyLoyalty &&
    insights.recencyLoyalty.frequencyCoolingCount === null
  ) {
    missingForBetterBriefing.push(
      'Historique client_visits daté pour détecter un refroidissement de fréquence'
    );
  }
  if (
    insights.recencyLoyalty?.repeatRateMethod === 'lifetime_proxy'
  ) {
    missingForBetterBriefing.push(
      'Timbres client_visits (méthode visit_windows) pour un repeat rate plus fidèle que le proxy lifetime'
    );
  }
  if (!insights.campaignActivity) {
    missingForBetterBriefing.push(
      'Lecture campagnes / campaign_sends pour publier l’activité d’envoi'
    );
  } else if (
    insights.campaignActivity.sendsInPeriod === 0 &&
    insights.campaignActivity.campaignsInPeriod === 0
  ) {
    missingForBetterBriefing.push(
      'Campagnes créées ou envois datés sur la période pour des stats d’exécution'
    );
  } else if (insights.campaignActivity.markedSentRatePct === null) {
    missingForBetterBriefing.push(
      'Au moins 5 envois marked sent ou failed pour publier un taux de marquage fiable'
    );
  }
  missingForBetterBriefing.push(
    'Opens / clics / delivery WhatsApp API / ROI campagne (non disponibles en CRM)'
  );

  const items = Array.from(byFamily.values()).sort(
    (a, b) => b.rankScore - a.rankScore || a.id.localeCompare(b.id)
  );

  let status: MiProactiveBriefing['status'] = 'ready';
  let summary: string;
  if (items.length === 0) {
    status = 'empty';
    summary =
      'Aucun signal prioritaire déclenché pour cette période (seuils non atteints) — aucun chiffre inventé.';
  } else {
    const top = items.slice(0, 3).map((i) => i.title);
    summary = `Briefing proactif (${items.length} signal${items.length > 1 ? 's' : ''}) — priorités : ${top.join(' · ')}`;
  }

  return {
    period,
    dataQuality: insights.dataQuality,
    status,
    summary,
    items,
    missingForBetterBriefing: Array.from(new Set(missingForBetterBriefing)),
    limitations: Array.from(new Set(limitations)),
    executionNote: EXECUTION_NOTE,
  };
}
