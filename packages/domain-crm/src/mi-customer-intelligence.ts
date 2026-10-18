/**
 * Marketing Intelligence P2 — intelligence client & stratégies de fidélisation.
 * Déterministe, lecture seule, aligné sur getClientDashboard / computeClientSegment.
 *
 * NON DISPONIBLE sans nouveau schéma : évolution historique des segments
 * (pas de snapshots segment_at / historique de computeClientSegment).
 */
import { percentChange, type ClientDashboard } from './client-dashboard';
import { INACTIVE_DAYS_THRESHOLD, type ClientSegment } from './segments';
import type { Client } from './clients';
import type { MiInactiveClient, MiPeriodMeta, MiTopClient, MiDataQuality } from './mi-tools';

export type MiMetricUnit = 'count' | 'money' | 'days' | 'ratio' | 'frequency';
export type MiMetricScope = 'selected_period' | 'point_in_time' | 'lifetime_aggregate';
export type MiRetentionConfidence = 'low' | 'medium';
export type MiRetentionPriority = 'high' | 'medium' | 'low';

export type MiRetentionRuleId =
  | 'reactivate_inactive'
  | 'nurture_at_risk'
  | 'thank_regular'
  | 'recognize_vip'
  | 'encourage_second_purchase'
  | 'recognize_top_spenders_period';

export interface MiCustomerMetric {
  id: string;
  /** Libellé court FR (UI peut traduire). */
  label: string;
  /**
   * null = métrique non établie (données manquantes).
   * 0 = valeur réelle zéro (ex. aucun nouveau client sur la période).
   */
  value: number | null;
  unit: MiMetricUnit;
  source: string;
  periodScope: MiMetricScope;
  inclusionRules: string;
  limits: string[];
  /** Clarifie la sémantique du zéro. */
  zeroMeans: string;
}

export interface MiSegmentSnapshot {
  counts: Record<ClientSegment, number>;
  source: string;
  /** Segments = état courant (now), pas un historique de période. */
  asOf: 'point_in_time_now';
  /** Toujours false tant qu’il n’y a pas de snapshots / migration. */
  evolutionAvailable: false;
  evolutionNote: string;
}

export interface MiCustomerIntelligence {
  period: Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to' | 'definition'>;
  dataQuality: MiDataQuality;
  metrics: MiCustomerMetric[];
  segments: MiSegmentSnapshot | null;
  /** Récence médiane (jours) parmi clients avec last_visit_at — point in time. */
  medianRecencyDays: number | null;
}

export interface MiRetentionStrategy {
  id: string;
  ruleId: MiRetentionRuleId;
  priority: MiRetentionPriority;
  segmentKey: ClientSegment | 'top_spenders_period' | 'new_period';
  headcount: number;
  selectionCriteria: string;
  facts: string[];
  period: Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to'>;
  marketingObjective: string;
  suggestedAction: string;
  limits: string[];
  /** Jamais « high » : pas de prédiction validée. */
  confidence: MiRetentionConfidence;
  rankScore: number;
}

function priorityRank(p: MiRetentionPriority): number {
  if (p === 'high') return 300;
  if (p === 'medium') return 200;
  return 100;
}

function daysSinceAt(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

export function computeMedianRecencyDays(
  clients: Array<Pick<Client, 'last_visit_at' | 'visit_count'>>,
  now: Date = new Date()
): number | null {
  const days: number[] = [];
  for (const c of clients) {
    if (!c.last_visit_at || (c.visit_count ?? 0) <= 0) continue;
    const d = daysSinceAt(c.last_visit_at, now);
    if (Number.isFinite(d) && d >= 0) days.push(d);
  }
  return median(days);
}

export interface BuildMiCustomerIntelligenceInput {
  period: MiPeriodMeta;
  dataQuality: MiDataQuality;
  kpis: ClientDashboard['kpis'] | null;
  segments: Record<ClientSegment, number> | null;
  clientCount: number;
  medianRecencyDays: number | null;
  currency: string;
}

/**
 * Métriques client calculables sans nouveau schéma.
 * Les métriques de période sont null si dataQuality=insufficient (≠ zéro inventé).
 */
export function buildMiCustomerIntelligence(
  input: BuildMiCustomerIntelligenceInput
): MiCustomerIntelligence {
  const { period, dataQuality, kpis, segments, clientCount, medianRecencyDays, currency } = input;
  const periodSlice = {
    code: period.code,
    label: period.label,
    from: period.from,
    to: period.to,
    definition: period.definition,
  };

  const metrics: MiCustomerMetric[] = [];

  // Point-in-time : récence (indépendant des commandes de la période)
  metrics.push({
    id: 'median_recency_days',
    label: 'Récence médiane (dernier achat / visite)',
    value: clientCount === 0 ? null : medianRecencyDays,
    unit: 'days',
    source: 'clients.last_visit_at (médiane des clients avec visite > 0)',
    periodScope: 'point_in_time',
    inclusionRules: 'Clients avec last_visit_at non null et visit_count > 0.',
    limits: [
      'Point dans le temps (maintenant), pas une récence calculée « à la fin de la période précédente ».',
      'Basé sur last_visit_at agrégé client, pas uniquement sur client_visits filtrées période.',
    ],
    zeroMeans: '0 jour = au moins un client a une visite enregistrée aujourd’hui (médiane).',
  });

  const periodAvailable = dataQuality !== 'insufficient' && kpis !== null;

  metrics.push({
    id: 'period_spend',
    label: 'Dépenses cumulées (période)',
    value: periodAvailable ? kpis!.revenue : null,
    unit: 'money',
    source: 'ClientDashboard.kpis.revenue (commandes paid / partially_refunded, montant net)',
    periodScope: 'selected_period',
    inclusionRules: `Période dashboard « ${period.label} » (${period.from} → ${period.to}), fuseau org.`,
    limits: ['Devise org. Pas de marge / coût.'],
    zeroMeans: `0 ${currency} = aucune dépense nette comptabilisée sur la période (si métrique établie).`,
  });

  metrics.push({
    id: 'period_visits',
    label: 'Fréquence — commandes / visites (période)',
    value: periodAvailable ? kpis!.visits : null,
    unit: 'count',
    source: 'ClientDashboard.kpis.visits',
    periodScope: 'selected_period',
    inclusionRules: 'Visites/commandes revenue-eligible dans la fenêtre période.',
    limits: ['Une ligne client_visits = une visite ; pas de panier multi-jours consolidé autrement.'],
    zeroMeans: '0 = aucune visite revenue sur la période.',
  });

  metrics.push({
    id: 'period_frequency_per_client',
    label: 'Fréquence moyenne (visites / client servi)',
    value: periodAvailable ? kpis!.frequency : null,
    unit: 'frequency',
    source: 'ClientDashboard.kpis.frequency',
    periodScope: 'selected_period',
    inclusionRules: 'visits / clientsServed si clientsServed > 0, sinon 0.',
    limits: ['Moyenne sur clients ayant commandé dans la période uniquement.'],
    zeroMeans: '0 = aucun client servi ou aucune visite.',
  });

  metrics.push({
    id: 'period_average_basket',
    label: 'Panier moyen (période)',
    value: periodAvailable ? kpis!.averageBasket : null,
    unit: 'money',
    source: 'ClientDashboard.kpis.averageBasket',
    periodScope: 'selected_period',
    inclusionRules: 'CA net / nombre de visites payantes (amount > 0) sur la période.',
    limits: ['Nécessite des commandes payées ; sinon métrique non établie (insufficient).'],
    zeroMeans: '0 = panier moyen nul si des visites existent sans montant (rare).',
  });

  metrics.push({
    id: 'period_clients_served',
    label: 'Clients servis (période)',
    value: periodAvailable ? kpis!.clientsServed : null,
    unit: 'count',
    source: 'ClientDashboard.kpis.clientsServed',
    periodScope: 'selected_period',
    inclusionRules: 'Clients distincts avec au moins une visite revenue dans la période.',
    limits: [],
    zeroMeans: '0 = aucun client servi sur la période.',
  });

  metrics.push({
    id: 'period_new_clients',
    label: 'Nouveaux clients (création fiche)',
    value: periodAvailable ? kpis!.newClients : null,
    unit: 'count',
    source: 'ClientDashboard.kpis.newClients',
    periodScope: 'selected_period',
    inclusionRules: 'created_at de la fiche client dans la fenêtre période (pas 1re visite payée).',
    limits: ['Peut différer d’un « premier achat » si la fiche est créée avant la 1re commande.'],
    zeroMeans: '0 = aucune fiche créée dans la période.',
  });

  metrics.push({
    id: 'period_returning_clients',
    label: 'Clients récurrents (≥ 2 visites période)',
    value: periodAvailable ? kpis!.returningClients : null,
    unit: 'count',
    source: 'ClientDashboard.kpis.returningClients',
    periodScope: 'selected_period',
    inclusionRules: 'Clients avec ≥ 2 visites revenue dans la période sélectionnée.',
    limits: ['Récurrence intra-période uniquement (pas lifetime).'],
    zeroMeans: '0 = aucun client avec 2+ visites sur la période.',
  });

  if (periodAvailable && kpis) {
    const newDelta = percentChange(kpis.newClients, kpis.previousNewClients);
    metrics.push({
      id: 'period_new_clients_vs_previous',
      label: 'Évolution nouveaux clients vs période précédente',
      value: newDelta,
      unit: 'ratio',
      source: 'percentChange(newClients, previousNewClients)',
      periodScope: 'selected_period',
      inclusionRules: 'Variation relative % ; null si previousNewClients = 0.',
      limits: [
        'Ce n’est PAS une évolution des segments CRM (new/regular/vip/…).',
        'Uniquement le flux de créations de fiches.',
      ],
      zeroMeans: '0 % = même nombre de nouveaux que la période précédente.',
    });
  } else {
    metrics.push({
      id: 'period_new_clients_vs_previous',
      label: 'Évolution nouveaux clients vs période précédente',
      value: null,
      unit: 'ratio',
      source: 'percentChange(newClients, previousNewClients)',
      periodScope: 'selected_period',
      inclusionRules: 'Requiert KPIs de période fiables.',
      limits: ['Non établi lorsque dataQuality=insufficient.'],
      zeroMeans: 'n/a',
    });
  }

  const segmentSnapshot: MiSegmentSnapshot | null =
    segments && clientCount > 0
      ? {
          counts: { ...segments },
          source: 'computeClientSegment sur listAllClients (identique dashboard clients)',
          asOf: 'point_in_time_now',
          evolutionAvailable: false,
          evolutionNote:
            'Évolution historique des segments non disponible : pas de table de snapshots ni de rejeu « as-of » sans migration. Seuls les effectifs actuels et les KPIs de période (ex. nouveaux clients) sont exposés.',
        }
      : null;

  return {
    period: periodSlice,
    dataQuality,
    metrics,
    segments: segmentSnapshot,
    medianRecencyDays: clientCount === 0 ? null : medianRecencyDays,
  };
}

export interface BuildMiRetentionStrategiesInput {
  period: MiPeriodMeta;
  dataQuality: MiDataQuality;
  segments: Record<ClientSegment, number> | null;
  inactiveLoyal: MiInactiveClient[];
  topClients: MiTopClient[];
  kpis: ClientDashboard['kpis'] | null;
  clientCount: number;
  currency: string;
}

/**
 * Stratégies de fidélisation déterministes.
 * Basées sur segments CRM + ranking période ; pas de ROI ni conversion prédite.
 * Disponibles dès qu’il y a des clients (même si période sans commande payée).
 */
export function buildMiRetentionStrategies(
  input: BuildMiRetentionStrategiesInput
): MiRetentionStrategy[] {
  if (input.clientCount === 0) return [];

  const { period, segments, inactiveLoyal, topClients, kpis, currency, dataQuality } = input;
  const periodSlice = {
    code: period.code,
    label: period.label,
    from: period.from,
    to: period.to,
  };
  const out: MiRetentionStrategy[] = [];
  const seg = segments ?? { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 0 };

  const inactiveCount = seg.inactive;
  const inactiveSpend = inactiveLoyal
    .filter((c) => c.segment === 'inactive')
    .reduce((s, c) => s + c.totalSpent, 0);
  if (inactiveCount >= 1 || inactiveLoyal.some((c) => c.segment === 'inactive')) {
    const headcount = Math.max(inactiveCount, inactiveLoyal.filter((c) => c.segment === 'inactive').length);
    const priority: MiRetentionPriority =
      headcount >= 10 || inactiveSpend >= 200_000 ? 'high' : headcount >= 3 ? 'medium' : 'low';
    out.push({
      id: 'reactivate_inactive',
      ruleId: 'reactivate_inactive',
      priority,
      segmentKey: 'inactive',
      headcount,
      selectionCriteria: `computeClientSegment = inactive (visit_count ≥ 3 et last_visit ≥ ${INACTIVE_DAYS_THRESHOLD} j).`,
      facts: [
        `Effectif segment inactive (instantané) : ${inactiveCount}`,
        `Échantillon fidèles inactifs listés : ${inactiveLoyal.filter((c) => c.segment === 'inactive').length}`,
        inactiveSpend > 0
          ? `Dépense lifetime échantillon inactive : ${Math.round(inactiveSpend).toLocaleString('fr-FR')} ${currency}`
          : 'Dépense lifetime échantillon : non détaillée',
      ],
      period: periodSlice,
      marketingObjective: 'Réactiver des clients autrefois récurrents devenus inactifs.',
      suggestedAction:
        'Préparer un message de rappel personnalisé pour les plus gros dépensiers inactifs (brouillon manuel — aucun envoi MI).',
      limits: [
        'Segment instantané (now), pas un flux « devenus inactifs pendant la période ».',
        'Aucun taux de reconquête estimé.',
      ],
      confidence: 'medium',
      rankScore: priorityRank(priority) + Math.min(40, headcount),
    });
  }

  if (seg.at_risk >= 1) {
    const priority: MiRetentionPriority = seg.at_risk >= 10 ? 'high' : seg.at_risk >= 3 ? 'medium' : 'low';
    out.push({
      id: 'nurture_at_risk',
      ruleId: 'nurture_at_risk',
      priority,
      segmentKey: 'at_risk',
      headcount: seg.at_risk,
      selectionCriteria: `computeClientSegment = at_risk (inactif < 3 visites ou sans last_visit selon règles segments.ts, seuil ${INACTIVE_DAYS_THRESHOLD} j).`,
      facts: [`Effectif at_risk : ${seg.at_risk}`],
      period: periodSlice,
      marketingObjective: 'Empêcher le basculement vers l’inactivité prolongée.',
      suggestedAction:
        'Proposer une offre simple de retour (ex. plat signature) aux at_risk — validation humaine avant tout envoi.',
      limits: ['Pas de prédiction de churn. Critères = définitions CRM actuelles uniquement.'],
      confidence: 'medium',
      rankScore: priorityRank(priority) + Math.min(35, seg.at_risk),
    });
  }

  if (seg.vip >= 1) {
    out.push({
      id: 'recognize_vip',
      ruleId: 'recognize_vip',
      priority: 'medium',
      segmentKey: 'vip',
      headcount: seg.vip,
      selectionCriteria:
        'computeClientSegment = vip (total_spent ≥ 500_000 et last_visit < seuil inactivité).',
      facts: [`Effectif vip : ${seg.vip}`, 'Seuil dépense lifetime : 500 000 (unité devise org).'],
      period: periodSlice,
      marketingObjective: 'Reconnaître et conserver les meilleurs clients selon critère VIP CRM.',
      suggestedAction:
        'Remercier les VIP (message de gratitude / invitation exclusive) — brouillon hors envoi automatique.',
      limits: [
        'Seuil 500_000 peut être inadapté selon devise/marché ; c’est la règle CRM existante.',
        'Pas d’impact financier estimé.',
      ],
      confidence: 'medium',
      rankScore: priorityRank('medium') + Math.min(30, seg.vip * 2),
    });
  }

  if (seg.regular >= 1) {
    out.push({
      id: 'thank_regular',
      ruleId: 'thank_regular',
      priority: 'low',
      segmentKey: 'regular',
      headcount: seg.regular,
      selectionCriteria: 'computeClientSegment = regular (visite récente, non VIP).',
      facts: [`Effectif regular : ${seg.regular}`],
      period: periodSlice,
      marketingObjective: 'Renforcer l’habitude d’achat des clients réguliers actifs.',
      suggestedAction:
        'Message de remerciement court + rappel du plat préféré s’il est connu — sans pousser une promo agressive.',
      limits: ['Volume potentiellement large ; prioriser un sous-échantillon manuellement.'],
      confidence: 'low',
      rankScore: priorityRank('low') + Math.min(20, seg.regular),
    });
  }

  const newHeadcount = Math.max(seg.new, kpis?.newClients ?? 0);
  if (newHeadcount >= 1) {
    out.push({
      id: 'encourage_second_purchase',
      ruleId: 'encourage_second_purchase',
      priority: seg.new >= 5 || (kpis?.newClients ?? 0) >= 5 ? 'medium' : 'low',
      segmentKey: 'new_period',
      headcount: newHeadcount,
      selectionCriteria:
        'Segment CRM « new » et/ou kpis.newClients (fiches créées dans la période dashboard).',
      facts: [
        `Segment new (instantané) : ${seg.new}`,
        kpis
          ? `Nouveaux (création fiche période ${period.label}) : ${kpis.newClients}`
          : 'KPIs période indisponibles — effectif basé sur segment new uniquement',
        `dataQuality période : ${dataQuality}`,
      ],
      period: periodSlice,
      marketingObjective: 'Encourager un deuxième passage après la première interaction.',
      suggestedAction:
        'Message d’accueil + invitation à revenir (offre douce) pour les nouveaux — validation humaine.',
      limits: [
        '« Nouveau » CRM ≠ toujours « premier achat payé ».',
        'Aucune conversion 2e achat prédite.',
      ],
      confidence: 'low',
      rankScore: priorityRank(seg.new >= 5 ? 'medium' : 'low') + Math.min(25, newHeadcount),
    });
  }

  if (topClients.length >= 1 && dataQuality !== 'insufficient') {
    const topSpend = topClients.reduce((s, c) => s + c.spent, 0);
    out.push({
      id: 'recognize_top_spenders_period',
      ruleId: 'recognize_top_spenders_period',
      priority: 'high',
      segmentKey: 'top_spenders_period',
      headcount: topClients.length,
      selectionCriteria: 'dashboard.ranking période (dépense nette > 0), top N MI.',
      facts: [
        `Top clients période : ${topClients.length}`,
        `Dépense cumulée top listé : ${Math.round(topSpend).toLocaleString('fr-FR')} ${currency}`,
        `Période : ${period.from} → ${period.to}`,
      ],
      period: periodSlice,
      marketingObjective: 'Reconnaître les meilleurs clients de la période sélectionnée.',
      suggestedAction:
        'Remercier le top 3–5 (message personnalisé) — critères = dépense période dashboard, pas une prédiction.',
      limits: ['Classement période uniquement ; un VIP lifetime absent du ranking période est possible.'],
      confidence: 'medium',
      rankScore: priorityRank('high') + Math.min(40, topClients.length * 3),
    });
  }

  return out.sort((a, b) => b.rankScore - a.rankScore || a.id.localeCompare(b.id));
}
