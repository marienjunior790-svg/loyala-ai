/**
 * P2.4 — Snapshot avis clients pour MI / Bomaye.
 * Pure : pas d’INSERT, pas de réponse auto, pas d’analyse NLP inventée.
 */
import { localDay } from './client-dashboard';
import type { Review } from './reviews';

/** Minimum d’avis notés par fenêtre pour publier une tendance (anti-bruit). */
export const MI_REVIEWS_TREND_MIN_RATED = 3;

/**
 * Baisse minimale (points /5) pour `reviewTrendDown` — plancher de fiabilité MI,
 * pas un nouveau seuil marketing Bomaye (REGLE-DEC-02 reste sur note < 4.0).
 */
export const MI_REVIEWS_TREND_DOWN_DELTA = 0.5;

export type MiReviewTrend = 'down' | 'up' | 'flat' | null;

/**
 * Complétude de l’échantillon avis chargé.
 * - true : le total matching est connu et entièrement chargé, OU chargement < plafond sans doute.
 * - false : total matching connu et > échantillon (troncature certaine).
 * - null : incertitude (plafond atteint sans count fiable) — ne pas afficher comme exhaustif.
 */
export type MiReviewsSampleCompleteness = boolean | null;

export interface MiReviewsInsight {
  /** Avis dont reviewed_at tombe dans la période MI. */
  periodReviewCount: number;
  /** Sous-ensemble avec note valide (1–5 finie). */
  ratedCount: number;
  /** Avis période avec commentaire non vide (trim). */
  withCommentCount: number;
  /** Moyenne uniquement si ratedCount > 0 — jamais 0 inventé si aucun avis. */
  averageRating: number | null;
  /** Fenêtre précédente (même logique dashboard) — moyenne ou null. */
  previousAverageRating: number | null;
  previousRatedCount: number;
  /** null si volume daté insuffisant pour une tendance fiable. */
  trend: MiReviewTrend;
  /** Delta current − previous ; null si tendance non publiée. */
  averageDelta: number | null;
  /** true uniquement si trend === 'down' (delta ≤ −MI_REVIEWS_TREND_DOWN_DELTA). */
  reviewTrendDown: boolean | null;
  pendingResponsesInPeriod: number;
  sources: string[];
  period: { from: string; to: string; label: string };
  previousPeriod: { from: string; to: string } | null;
  /** Échantillon lu (plafond listReviews) — peut sous-couvrir une longue période. */
  sampleSizeLoaded: number;
  /** Plafond de fetch demandé (ex. 200). */
  sampleFetchLimit: number;
  /** Total matching le filtre reviewedSince (count PostgREST) — null si indisponible. */
  totalMatchingInWindow: number | null;
  /**
   * true = échantillon complet ; false = tronqué (prouvé) ; null = incertitude.
   * Une moyenne avec sampleComplete !== true ne doit pas être présentée comme exhaustive.
   */
  sampleComplete: MiReviewsSampleCompleteness;
  limitations: string[];
}

/** Détermine la complétude à partir du count (si dispo) et du plafond. */
export function resolveReviewsSampleComplete(input: {
  sampleSizeLoaded: number;
  sampleFetchLimit: number;
  totalMatchingInWindow: number | null;
}): MiReviewsSampleCompleteness {
  const { sampleSizeLoaded, sampleFetchLimit, totalMatchingInWindow } = input;
  if (totalMatchingInWindow !== null && totalMatchingInWindow !== undefined) {
    return sampleSizeLoaded >= totalMatchingInWindow;
  }
  if (sampleSizeLoaded < sampleFetchLimit) return true;
  return null;
}

function isValidRating(value: unknown): value is number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function averageOf(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return round2(ratings.reduce((s, r) => s + r, 0) / ratings.length);
}

function inDayRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/**
 * Agrège les avis pour une période MI.
 * Ne calcule pas de thèmes / sentiment (non supporté par le produit).
 */
export function computeMiReviewsInsight(input: {
  reviews: Array<
    Pick<Review, 'rating' | 'content' | 'reviewed_at' | 'response_text' | 'source'>
  >;
  period: { from: string; to: string; label: string };
  previousPeriod?: { from: string; to: string } | null;
  timezone: string;
  /** Plafond de la requête listReviews (défaut = taille échantillon). */
  sampleFetchLimit?: number;
  /** Count exact matching le filtre fenêtre — null si indisponible. */
  totalMatchingInWindow?: number | null;
}): MiReviewsInsight {
  const limitations: string[] = [];
  const sampleSizeLoaded = input.reviews.length;
  const sampleFetchLimit = Math.max(
    1,
    input.sampleFetchLimit ?? Math.max(sampleSizeLoaded, 1)
  );
  const totalMatchingInWindow =
    input.totalMatchingInWindow === undefined ? null : input.totalMatchingInWindow;
  const sampleComplete = resolveReviewsSampleComplete({
    sampleSizeLoaded,
    sampleFetchLimit,
    totalMatchingInWindow,
  });

  if (sampleSizeLoaded === 0) {
    limitations.push(
      'Aucun avis client en base pour cette organisation (échantillon lu = 0).'
    );
    return {
      periodReviewCount: 0,
      ratedCount: 0,
      withCommentCount: 0,
      averageRating: null,
      previousAverageRating: null,
      previousRatedCount: 0,
      trend: null,
      averageDelta: null,
      reviewTrendDown: null,
      pendingResponsesInPeriod: 0,
      sources: [],
      period: input.period,
      previousPeriod: input.previousPeriod ?? null,
      sampleSizeLoaded: 0,
      sampleFetchLimit,
      totalMatchingInWindow,
      sampleComplete,
      limitations,
    };
  }

  limitations.push(
    'Analyse thématique / sentiment des commentaires non supportée — pas de verbatim inventé.'
  );
  limitations.push(
    'Absence d’avis ≠ mauvaise note ; moyenne publiée uniquement sur notes valides 1–5.'
  );

  if (sampleComplete === false) {
    limitations.push(
      `Échantillon avis tronqué : ${sampleSizeLoaded}/${totalMatchingInWindow} chargés (plafond ${sampleFetchLimit}) — moyenne/tendance non exhaustives.`
    );
  } else if (sampleComplete === null) {
    limitations.push(
      `Complétude avis incertaine : plafond ${sampleFetchLimit} atteint sans count total fiable — ne pas présenter la moyenne comme exhaustive.`
    );
  }

  const periodRated: number[] = [];
  const previousRated: number[] = [];
  let periodReviewCount = 0;
  let withCommentCount = 0;
  let pendingResponsesInPeriod = 0;
  const sources = new Set<string>();
  let undated = 0;

  for (const review of input.reviews) {
    const day = localDay(review.reviewed_at, input.timezone);
    if (!day) {
      undated += 1;
      continue;
    }

    const inPeriod = inDayRange(day, input.period.from, input.period.to);
    const inPrevious =
      input.previousPeriod != null &&
      inDayRange(day, input.previousPeriod.from, input.previousPeriod.to);

    if (!inPeriod && !inPrevious) continue;

    if (inPeriod) {
      periodReviewCount += 1;
      if (typeof review.source === 'string' && review.source.trim()) {
        sources.add(review.source.trim());
      }
      if ((review.content ?? '').trim().length > 0) withCommentCount += 1;
      if (!review.response_text) pendingResponsesInPeriod += 1;
      if (isValidRating(review.rating)) periodRated.push(Number(review.rating));
    }

    if (inPrevious && isValidRating(review.rating)) {
      previousRated.push(Number(review.rating));
    }
  }

  if (undated > 0) {
    limitations.push(
      `${undated} avis sans date locale exploitable exclus du découpage périodique.`
    );
  }

  const averageRating = averageOf(periodRated);
  const previousAverageRating = averageOf(previousRated);

  if (periodReviewCount === 0) {
    limitations.push(
      `Aucun avis daté sur la période ${input.period.from} → ${input.period.to} (échantillon chargé = ${sampleSizeLoaded}).`
    );
  } else if (periodRated.length === 0) {
    limitations.push(
      `${periodReviewCount} avis sur la période mais aucune note valide 1–5 — moyenne non publiée.`
    );
  }

  let trend: MiReviewTrend = null;
  let averageDelta: number | null = null;
  let reviewTrendDown: boolean | null = null;

  const prev = input.previousPeriod;
  if (!prev) {
    limitations.push('Fenêtre précédente absente — tendance avis non calculable.');
  } else if (
    periodRated.length < MI_REVIEWS_TREND_MIN_RATED ||
    previousRated.length < MI_REVIEWS_TREND_MIN_RATED
  ) {
    limitations.push(
      `Tendance avis non publiée (besoin ≥ ${MI_REVIEWS_TREND_MIN_RATED} notes valides par fenêtre ; actuel=${periodRated.length}, précédent=${previousRated.length}).`
    );
  } else if (averageRating === null || previousAverageRating === null) {
    limitations.push('Tendance avis non publiée (moyenne manquante sur une fenêtre).');
  } else {
    averageDelta = round2(averageRating - previousAverageRating);
    if (averageDelta <= -MI_REVIEWS_TREND_DOWN_DELTA) {
      trend = 'down';
      reviewTrendDown = true;
    } else if (averageDelta >= MI_REVIEWS_TREND_DOWN_DELTA) {
      trend = 'up';
      reviewTrendDown = false;
    } else {
      trend = 'flat';
      reviewTrendDown = false;
    }
  }

  return {
    periodReviewCount,
    ratedCount: periodRated.length,
    withCommentCount,
    averageRating,
    previousAverageRating,
    previousRatedCount: previousRated.length,
    trend,
    averageDelta,
    reviewTrendDown,
    pendingResponsesInPeriod,
    sources: Array.from(sources).sort(),
    period: input.period,
    previousPeriod: prev ?? null,
    sampleSizeLoaded,
    sampleFetchLimit,
    totalMatchingInWindow,
    sampleComplete,
    limitations,
  };
}
