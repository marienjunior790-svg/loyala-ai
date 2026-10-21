/**
 * P2.5 — Récence & fidélisation (lecture seule).
 * Ne confond pas inactif avec « perdu » ; n’invente pas d’historique de segments.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { REVENUE_ORDER_STATUSES } from './orders';
import { INACTIVE_DAYS_THRESHOLD, type ClientSegment } from './segments';
import type { Client } from './clients';

/** Fenêtre Bomaye REGLE-DEC-02 (repeat rate 60 j). */
export const MI_REPEAT_RATE_WINDOW_DAYS = 60;

/** Cohort minimale pour publier un repeat rate (anti-bruit). */
export const MI_REPEAT_RATE_MIN_COHORT = 5;

/** Visites min. sur la moitié « ancienne » pour signaler un refroidissement. */
export const MI_FREQUENCY_COOLING_MIN_PRIOR = 2;

export type MiRepeatRateMethod = 'visit_windows' | 'lifetime_proxy';

export interface MiVisitStamp {
  client_id: string;
  visited_at: string;
}

export interface MiRecencyLoyaltyInsight {
  asOfIso: string;
  inactiveThresholdDays: number;
  clientCount: number;
  withLastVisitCount: number;
  neverVisitedCount: number;
  /** last_visit < seuil inactivité CRM (actifs récents). */
  recentActiveCount: number;
  /**
   * Segment `inactive` + visit_count ≥ 3 : autrefois réguliers, sans visite récente.
   * ≠ clients « perdus » (statut commercial non observable ici).
   */
  formerlyRegularInactiveCount: number;
  atRiskCount: number;
  medianRecencyDays: number | null;
  /** null si cohort trop petite ou données insuffisantes — jamais 0 inventé. */
  repeatRate60dPct: number | null;
  repeatRateMethod: MiRepeatRateMethod | null;
  repeatRateCohortSize: number;
  repeatRateRepeaters: number;
  /**
   * Clients avec activité plus dense sur J-60…J-30 que sur J-30…J-0.
   * null si pas assez de timbres de visite chargés.
   */
  frequencyCoolingCount: number | null;
  sampleVisitsLoaded: number;
  segmentCounts: Record<ClientSegment, number>;
  limitations: string[];
}

function daysBetween(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

function emptySegments(): Record<ClientSegment, number> {
  return { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 0 };
}

/**
 * Même règles que computeClientSegment, avec `now` injecté (tests / as-of).
 * Ne persiste rien en DB.
 */
function segmentAt(
  client: Pick<Client, 'visit_count' | 'last_visit_at' | 'total_spent' | 'created_at'>,
  now: Date
): ClientSegment {
  const visitCount = client.visit_count ?? 0;
  const lastVisit = client.last_visit_at;
  const totalSpent = Number(client.total_spent ?? 0);

  if (
    visitCount > 0 &&
    totalSpent >= 500_000 &&
    lastVisit &&
    daysBetween(lastVisit, now) < INACTIVE_DAYS_THRESHOLD
  ) {
    return 'vip';
  }

  if (!lastVisit) {
    if (visitCount === 0) {
      if (client.created_at && daysBetween(client.created_at, now) >= INACTIVE_DAYS_THRESHOLD) {
        return 'at_risk';
      }
      return 'new';
    }
    return 'at_risk';
  }

  const daysInactive = daysBetween(lastVisit, now);
  if (daysInactive >= INACTIVE_DAYS_THRESHOLD) {
    return visitCount >= 3 ? 'inactive' : 'at_risk';
  }

  if (visitCount > 0) return 'regular';
  return 'new';
}

/**
 * Charge des timbres de visite (client_id, visited_at) pour la fenêtre récence.
 * RLS org ; statuts revenue uniquement ; plafond pour rester local/léger.
 */
export async function listVisitStampsForLoyalty(
  supabase: SupabaseClient,
  organizationId: string,
  sinceIso: string,
  options: { limit?: number } = {}
): Promise<MiVisitStamp[]> {
  const limit = Math.min(Math.max(options.limit ?? 2000, 1), 5000);
  const { data, error } = await supabase
    .from('client_visits')
    .select('client_id, visited_at')
    .eq('organization_id', organizationId)
    .in('status', [...REVENUE_ORDER_STATUSES])
    .gte('visited_at', sinceIso)
    .order('visited_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MiVisitStamp[];
}

/**
 * Agrège récence / fidélisation à partir des clients (+ visites optionnelles).
 */
export function computeMiRecencyLoyaltyInsight(input: {
  clients: Array<
    Pick<Client, 'id' | 'visit_count' | 'last_visit_at' | 'total_spent' | 'created_at'>
  >;
  visits?: MiVisitStamp[];
  now?: Date;
}): MiRecencyLoyaltyInsight {
  const now = input.now ?? new Date();
  const limitations: string[] = [
    'Inactif ≠ perdu : absence de visite récente n’implique pas un départ définitif.',
    'Évolution historique des segments non disponible sans snapshots (pas inventée).',
    'Aucune relance WhatsApp / campagne automatique depuis ce signal.',
  ];

  const segmentCounts = emptySegments();
  let withLastVisitCount = 0;
  let neverVisitedCount = 0;
  let recentActiveCount = 0;
  let formerlyRegularInactiveCount = 0;
  let atRiskCount = 0;
  const recencyDays: number[] = [];

  for (const c of input.clients) {
    const segment = segmentAt(c, now);
    segmentCounts[segment] += 1;

    const visits = c.visit_count ?? 0;
    if (!c.last_visit_at || visits <= 0) {
      neverVisitedCount += 1;
      if (segment === 'at_risk') atRiskCount += 1;
      continue;
    }

    withLastVisitCount += 1;
    const days = daysBetween(c.last_visit_at, now);
    if (Number.isFinite(days) && days >= 0) recencyDays.push(days);

    if (days < INACTIVE_DAYS_THRESHOLD) recentActiveCount += 1;
    if (segment === 'inactive' && visits >= 3) formerlyRegularInactiveCount += 1;
    if (segment === 'at_risk') atRiskCount += 1;
  }

  const medianRecencyDays = median(recencyDays);
  const visits = input.visits ?? [];
  const sampleVisitsLoaded = visits.length;

  let repeatRate60dPct: number | null = null;
  let repeatRateMethod: MiRepeatRateMethod | null = null;
  let repeatRateCohortSize = 0;
  let repeatRateRepeaters = 0;
  let frequencyCoolingCount: number | null = null;

  if (sampleVisitsLoaded > 0) {
    const recent = new Set<string>();
    const prior = new Set<string>();
    const countsRecent30 = new Map<string, number>();
    const countsPrior30 = new Map<string, number>();

    for (const v of visits) {
      const d = daysBetween(v.visited_at, now);
      if (!Number.isFinite(d) || d < 0) continue;
      if (d < MI_REPEAT_RATE_WINDOW_DAYS) {
        recent.add(v.client_id);
        if (d < MI_REPEAT_RATE_WINDOW_DAYS / 2) {
          countsRecent30.set(v.client_id, (countsRecent30.get(v.client_id) ?? 0) + 1);
        } else {
          countsPrior30.set(v.client_id, (countsPrior30.get(v.client_id) ?? 0) + 1);
        }
      } else if (d < MI_REPEAT_RATE_WINDOW_DAYS * 2) {
        prior.add(v.client_id);
      }
    }

    repeatRateCohortSize = recent.size;
    for (const id of recent) {
      if (prior.has(id)) repeatRateRepeaters += 1;
    }

    if (repeatRateCohortSize >= MI_REPEAT_RATE_MIN_COHORT) {
      repeatRate60dPct = round2((repeatRateRepeaters / repeatRateCohortSize) * 100);
      repeatRateMethod = 'visit_windows';
    } else {
      limitations.push(
        `Repeat rate 60 j non publié (cohort récente=${repeatRateCohortSize} < ${MI_REPEAT_RATE_MIN_COHORT}).`
      );
    }

    let cooling = 0;
    const candidates = new Set([...countsPrior30.keys(), ...countsRecent30.keys()]);
    for (const id of candidates) {
      const priorN = countsPrior30.get(id) ?? 0;
      const recentN = countsRecent30.get(id) ?? 0;
      if (priorN >= MI_FREQUENCY_COOLING_MIN_PRIOR && recentN < priorN) cooling += 1;
    }
    frequencyCoolingCount = cooling;

    if (sampleVisitsLoaded >= 2000) {
      limitations.push(
        'Échantillon visites plafonné — repeat rate / refroidissement peuvent sous-couvrir une org très active.'
      );
    }
  } else {
    // Proxy lifetime : clients actifs sur 60 j avec visit_count ≥ 2.
    const cohort: string[] = [];
    let repeaters = 0;
    for (const c of input.clients) {
      if (!c.last_visit_at || (c.visit_count ?? 0) <= 0) continue;
      const d = daysBetween(c.last_visit_at, now);
      if (d < 0 || d >= MI_REPEAT_RATE_WINDOW_DAYS) continue;
      cohort.push(c.id);
      if ((c.visit_count ?? 0) >= 2) repeaters += 1;
    }
    repeatRateCohortSize = cohort.length;
    repeatRateRepeaters = repeaters;
    if (repeatRateCohortSize >= MI_REPEAT_RATE_MIN_COHORT) {
      repeatRate60dPct = round2((repeaters / repeatRateCohortSize) * 100);
      repeatRateMethod = 'lifetime_proxy';
      limitations.push(
        'Repeat rate = proxy lifetime (clients vus ≤ 60 j avec visit_count ≥ 2) — pas un taux de retour strict « 2e visite sous 60 j » ; charger les visites pour visit_windows.'
      );
    } else {
      limitations.push(
        `Repeat rate non publié (cohort proxy=${repeatRateCohortSize} < ${MI_REPEAT_RATE_MIN_COHORT} ; pas de timbres visite).`
      );
    }
    frequencyCoolingCount = null;
    limitations.push(
      'Refroidissement de fréquence non calculable sans historique client_visits daté.'
    );
  }

  if (input.clients.length === 0) {
    limitations.push('Aucun client CRM — signaux récence non établis.');
  }

  return {
    asOfIso: now.toISOString(),
    inactiveThresholdDays: INACTIVE_DAYS_THRESHOLD,
    clientCount: input.clients.length,
    withLastVisitCount,
    neverVisitedCount,
    recentActiveCount,
    formerlyRegularInactiveCount,
    atRiskCount,
    medianRecencyDays,
    repeatRate60dPct,
    repeatRateMethod,
    repeatRateCohortSize,
    repeatRateRepeaters,
    frequencyCoolingCount,
    sampleVisitsLoaded,
    segmentCounts,
    limitations,
  };
}
