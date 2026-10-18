/**
 * Marketing Intelligence P1 — opportunités déterministes.
 * Règles explicites, testables, sans causalité inventée ni métrique fabriquée.
 */
import { percentChange, type ClientDashboard } from './client-dashboard';
import { INACTIVE_DAYS_THRESHOLD, type ClientSegment } from './segments';
import type { MiInactiveClient, MiPeriodMeta } from './mi-tools';

export type MiOpportunityPriority = 'high' | 'medium' | 'low';

export type MiOpportunityRuleId =
  | 'revenue_drop_significant'
  | 'revenue_rise_significant'
  | 'inactive_loyal_reconquest'
  | 'at_risk_segment_size'
  | 'new_clients_drop'
  | 'visits_drop_significant';

export interface MiOpportunity {
  id: string;
  ruleId: MiOpportunityRuleId;
  priority: MiOpportunityPriority;
  /** Faits observés (chiffres CRM uniquement). */
  facts: string[];
  /** Identifiant de règle documenté (pour UI / tests). */
  detectionRule: string;
  period: Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to'>;
  limits: string[];
  suggestedAction: string;
  /** Score interne pour le classement (plus élevé = plus prioritaire). */
  rankScore: number;
}

/** Variation relative minimale pour parler de « significative » (20 %). */
export const MI_TREND_SIGNIFICANT_PCT = 20;

/**
 * Volume minimal combiné (période + comparaison) pour valider une tendance CA/visites.
 * Évite les alertes sur 1–2 tickets.
 */
export const MI_TREND_MIN_COMBINED_VISITS = 8;

/** Minimum de nouveaux clients en période précédente pour alerter une baisse. */
export const MI_NEW_CLIENTS_PREV_MIN = 3;

/** Seuil d’effectif at_risk pour une opportunité dédiée. */
export const MI_AT_RISK_MIN_COUNT = 3;

/** Seuil de fidèles inactifs pour une opportunité reconquête. */
export const MI_INACTIVE_LOYAL_MIN = 1;

export interface BuildMiOpportunitiesInput {
  period: MiPeriodMeta;
  dataQuality: 'ok' | 'partial' | 'insufficient';
  kpis: ClientDashboard['kpis'] | null;
  segments: Record<ClientSegment, number> | null;
  inactiveLoyal: MiInactiveClient[];
  currency: string;
}

function priorityRank(p: MiOpportunityPriority): number {
  if (p === 'high') return 300;
  if (p === 'medium') return 200;
  return 100;
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct} %`;
}

function formatAmount(n: number, currency: string): string {
  const rounded = Math.round(n);
  return `${rounded.toLocaleString('fr-FR')} ${currency}`;
}

/**
 * Construit la liste d’opportunités à partir du snapshot CRM uniquement.
 * Si dataQuality=insufficient → liste vide (pas de faux signal).
 */
export function buildMiOpportunities(input: BuildMiOpportunitiesInput): MiOpportunity[] {
  if (input.dataQuality === 'insufficient' || !input.kpis) {
    return [];
  }

  const { kpis, period, currency } = input;
  const out: MiOpportunity[] = [];
  const periodSlice = {
    code: period.code,
    label: period.label,
    from: period.from,
    to: period.to,
  };

  const combinedVisits = kpis.visits + kpis.previousVisits;
  const revenuePct = percentChange(kpis.revenue, kpis.previousRevenue);
  const visitsPct = percentChange(kpis.visits, kpis.previousVisits);

  if (
    revenuePct !== null &&
    revenuePct <= -MI_TREND_SIGNIFICANT_PCT &&
    combinedVisits >= MI_TREND_MIN_COMBINED_VISITS &&
    kpis.previousRevenue > 0
  ) {
    out.push({
      id: 'revenue_drop_significant',
      ruleId: 'revenue_drop_significant',
      priority: revenuePct <= -35 ? 'high' : 'medium',
      facts: [
        `CA période : ${formatAmount(kpis.revenue, currency)}`,
        `CA période précédente : ${formatAmount(kpis.previousRevenue, currency)}`,
        `Variation : ${formatPct(revenuePct)}`,
        `Visites (période + comparaison) : ${combinedVisits}`,
      ],
      detectionRule: `Baisse de CA ≥ ${MI_TREND_SIGNIFICANT_PCT} % vs période précédente, avec ≥ ${MI_TREND_MIN_COMBINED_VISITS} visites combinées (source : dashboard.kpis).`,
      period: periodSlice,
      limits: [
        'Variation relative ≠ cause. Facteurs externes (saison, stock, événements) non mesurés ici.',
      ],
      suggestedAction:
        'Analyser les top produits et clients de la période précédente, puis cibler une relance des clients réguliers inactifs (sans envoi automatique).',
      rankScore: priorityRank(revenuePct <= -35 ? 'high' : 'medium') + Math.min(80, Math.abs(revenuePct)),
    });
  }

  if (
    revenuePct !== null &&
    revenuePct >= MI_TREND_SIGNIFICANT_PCT &&
    combinedVisits >= MI_TREND_MIN_COMBINED_VISITS &&
    kpis.previousRevenue > 0
  ) {
    out.push({
      id: 'revenue_rise_significant',
      ruleId: 'revenue_rise_significant',
      priority: 'low',
      facts: [
        `CA période : ${formatAmount(kpis.revenue, currency)}`,
        `CA période précédente : ${formatAmount(kpis.previousRevenue, currency)}`,
        `Variation : ${formatPct(revenuePct)}`,
        `Visites (période + comparaison) : ${combinedVisits}`,
      ],
      detectionRule: `Hausse de CA ≥ ${MI_TREND_SIGNIFICANT_PCT} % vs période précédente, avec ≥ ${MI_TREND_MIN_COMBINED_VISITS} visites combinées.`,
      period: periodSlice,
      limits: ['Hausse observée — ne pas l’attribuer automatiquement à une campagne.'],
      suggestedAction:
        'Identifier les plats et clients qui tirent la hausse pour reproduire l’offre (brouillon manuel).',
      rankScore: priorityRank('low') + Math.min(40, revenuePct),
    });
  }

  if (
    visitsPct !== null &&
    visitsPct <= -MI_TREND_SIGNIFICANT_PCT &&
    combinedVisits >= MI_TREND_MIN_COMBINED_VISITS &&
    kpis.previousVisits > 0 &&
    // éviter doublon purement redondant si CA chute déjà fortement
    !(revenuePct !== null && revenuePct <= -MI_TREND_SIGNIFICANT_PCT)
  ) {
    out.push({
      id: 'visits_drop_significant',
      ruleId: 'visits_drop_significant',
      priority: 'medium',
      facts: [
        `Visites période : ${kpis.visits}`,
        `Visites période précédente : ${kpis.previousVisits}`,
        `Variation : ${formatPct(visitsPct)}`,
      ],
      detectionRule: `Baisse de visites ≥ ${MI_TREND_SIGNIFICANT_PCT} % avec volume combiné ≥ ${MI_TREND_MIN_COMBINED_VISITS}.`,
      period: periodSlice,
      limits: ['Fréquentation ≠ CA : le panier moyen peut compenser ou aggraver.'],
      suggestedAction:
        'Vérifier les clients à risque / inactifs et préparer un message de rappel (validation humaine).',
      rankScore: priorityRank('medium') + Math.min(60, Math.abs(visitsPct)),
    });
  }

  const inactive = input.inactiveLoyal;
  if (inactive.length >= MI_INACTIVE_LOYAL_MIN) {
    const totalSpent = inactive.reduce((s, c) => s + c.totalSpent, 0);
    const priority: MiOpportunityPriority =
      inactive.length >= 10 || totalSpent >= 200_000 ? 'high' : inactive.length >= 3 ? 'medium' : 'low';
    out.push({
      id: 'inactive_loyal_reconquest',
      ruleId: 'inactive_loyal_reconquest',
      priority,
      facts: [
        `${inactive.length} client(s) fidèle(s) en segment inactive ou at_risk (min. 2 visites historiques)`,
        `Dépense cumulée historique (échantillon) : ${formatAmount(totalSpent, currency)}`,
        `Seuil d’inactivité segments : ${INACTIVE_DAYS_THRESHOLD} jours`,
      ],
      detectionRule: `listInactiveLoyalClients : segment inactive|at_risk, visit_count ≥ 2, seuil ${INACTIVE_DAYS_THRESHOLD} j (computeClientSegment).`,
      period: periodSlice,
      limits: [
        'Basé sur last_visit_at / agrégats clients, pas uniquement sur la période sélectionnée.',
        'Ne prouve pas qu’un message reconquerra ces clients.',
      ],
      suggestedAction:
        'Prioriser les plus gros dépensiers inactifs pour un brouillon de relance WhatsApp (envoi hors MI).',
      rankScore: priorityRank(priority) + Math.min(50, inactive.length * 3),
    });
  }

  const atRisk = input.segments?.at_risk ?? 0;
  if (atRisk >= MI_AT_RISK_MIN_COUNT) {
    out.push({
      id: 'at_risk_segment_size',
      ruleId: 'at_risk_segment_size',
      priority: atRisk >= 10 ? 'high' : 'medium',
      facts: [`Segment at_risk : ${atRisk} client(s)`, `Seuil règle : ≥ ${MI_AT_RISK_MIN_COUNT}`],
      detectionRule: `dashboard.segments.at_risk ≥ ${MI_AT_RISK_MIN_COUNT} (computeClientSegment).`,
      period: periodSlice,
      limits: ['Comptage instantané sur toute la base clients active, pas un flux de période.'],
      suggestedAction:
        'Lister les clients at_risk et préparer une offre de réactivation (sans attribution causale).',
      rankScore: priorityRank(atRisk >= 10 ? 'high' : 'medium') + Math.min(40, atRisk),
    });
  }

  const newPct = percentChange(kpis.newClients, kpis.previousNewClients);
  if (
    newPct !== null &&
    newPct <= -MI_TREND_SIGNIFICANT_PCT &&
    kpis.previousNewClients >= MI_NEW_CLIENTS_PREV_MIN
  ) {
    out.push({
      id: 'new_clients_drop',
      ruleId: 'new_clients_drop',
      priority: 'medium',
      facts: [
        `Nouveaux clients (période) : ${kpis.newClients}`,
        `Nouveaux clients (précédente) : ${kpis.previousNewClients}`,
        `Variation : ${formatPct(newPct)}`,
      ],
      detectionRule: `Baisse des créations clients ≥ ${MI_TREND_SIGNIFICANT_PCT} % avec previousNewClients ≥ ${MI_NEW_CLIENTS_PREV_MIN}.`,
      period: periodSlice,
      limits: [
        '« Nouveau » = date de création fiche client dans la fenêtre, pas première visite payée.',
      ],
      suggestedAction:
        'Vérifier les canaux d’acquisition habituels ; préparer un message d’accueil pour les nouveaux (manuel).',
      rankScore: priorityRank('medium') + Math.min(40, Math.abs(newPct)),
    });
  }

  return out.sort((a, b) => b.rankScore - a.rankScore || a.id.localeCompare(b.id));
}

export interface MiTrendPoint {
  current: number;
  previous: number;
  changePct: number | null;
  /** true si la variation est affichable comme « significative » avec volume OK. */
  significant: boolean;
}

export interface MiTrends {
  revenue: MiTrendPoint;
  visits: MiTrendPoint;
  clientsServed: MiTrendPoint;
  averageBasket: MiTrendPoint;
  newClients: MiTrendPoint;
  comparisonNote: string;
}

function trendPoint(
  current: number,
  previous: number,
  volumeOk: boolean
): MiTrendPoint {
  const changePct = percentChange(current, previous);
  const significant =
    volumeOk &&
    changePct !== null &&
    Math.abs(changePct) >= MI_TREND_SIGNIFICANT_PCT;
  return { current, previous, changePct, significant };
}

/** Tendances dérivées uniquement de ClientDashboard.kpis (+ note de comparaison). */
export function buildMiTrends(
  kpis: ClientDashboard['kpis'] | null,
  period: MiPeriodMeta
): MiTrends | null {
  if (!kpis) return null;
  const volumeOk = kpis.visits + kpis.previousVisits >= MI_TREND_MIN_COMBINED_VISITS;
  return {
    revenue: trendPoint(kpis.revenue, kpis.previousRevenue, volumeOk),
    visits: trendPoint(kpis.visits, kpis.previousVisits, volumeOk),
    clientsServed: trendPoint(kpis.clientsServed, kpis.previousClientsServed, volumeOk),
    averageBasket: trendPoint(kpis.averageBasket, kpis.previousAverageBasket, volumeOk),
    newClients: trendPoint(
      kpis.newClients,
      kpis.previousNewClients,
      kpis.previousNewClients >= MI_NEW_CLIENTS_PREV_MIN || kpis.newClients >= MI_NEW_CLIENTS_PREV_MIN
    ),
    comparisonNote: `Comparaison vs période précédente du dashboard (« ${period.label} » : ${period.from} → ${period.to}).`,
  };
}
