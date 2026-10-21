import type { SupabaseClient } from '@supabase/supabase-js';

export interface Review {
  id: string;
  organization_id: string;
  client_id: string | null;
  source: string;
  rating: number;
  author_name: string;
  content: string;
  review_url: string | null;
  response_text: string | null;
  responded_at: string | null;
  reviewed_at: string;
  created_at: string;
}

export interface ListReviewsOptions {
  /** Défaut 50 (UI reviews). MI peut élargir pour couvrir période + précédent. */
  limit?: number;
  /** Filtre inclusif ISO / timestamptz sur reviewed_at. */
  reviewedSince?: string;
}

export async function listReviews(
  supabase: SupabaseClient,
  organizationId: string,
  options: ListReviewsOptions = {}
): Promise<Review[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('organization_id', organizationId)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (options.reviewedSince) {
    query = query.gte('reviewed_at', options.reviewedSince);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

/**
 * Compte exact des avis matching le filtre (PostgREST count).
 * null si le count n’est pas disponible — ne pas inventer une troncature.
 */
export async function countReviews(
  supabase: SupabaseClient,
  organizationId: string,
  options: Pick<ListReviewsOptions, 'reviewedSince'> = {}
): Promise<number | null> {
  let query = supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (options.reviewedSince) {
    query = query.gte('reviewed_at', options.reviewedSince);
  }

  const { count, error } = await query;
  if (error) return null;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

export async function createReview(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    rating: number;
    authorName: string;
    content: string;
    source?: string;
    clientId?: string;
    reviewUrl?: string;
  }
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      organization_id: organizationId,
      client_id: input.clientId ?? null,
      source: input.source ?? 'manual',
      rating: input.rating,
      author_name: input.authorName,
      content: input.content,
      review_url: input.reviewUrl ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Review;
}

export async function respondToReview(
  supabase: SupabaseClient,
  organizationId: string,
  reviewId: string,
  responseText: string
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      response_text: responseText,
      responded_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Review;
}

export async function getReviewsSummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  count: number;
  /** null si aucun avis (jamais forcé à 0 comme « mauvaise note »). */
  averageRating: number | null;
  pendingResponses: number;
  ratedCount: number;
}> {
  const reviews = await listReviews(supabase, organizationId);
  const count = reviews.length;
  const rated = reviews.filter(
    (r) => Number.isFinite(Number(r.rating)) && Number(r.rating) >= 1 && Number(r.rating) <= 5
  );
  const ratedCount = rated.length;
  const averageRating =
    ratedCount > 0
      ? Math.round(
          (rated.reduce((s, r) => s + Number(r.rating), 0) / ratedCount) * 100
        ) / 100
      : null;
  const pendingResponses = reviews.filter((r) => !r.response_text).length;

  return { count, averageRating, pendingResponses, ratedCount };
}

/** Org settings helper: Google review write URL (Maps / g.page). */
export function getGoogleReviewUrl(settings: Record<string, unknown> | null | undefined): string {
  const raw = settings?.google_review_url;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function isGoogleReviewAutoRequestEnabled(
  settings: Record<string, unknown> | null | undefined
): boolean {
  if (settings?.google_review_auto_request === false) return false;
  return Boolean(getGoogleReviewUrl(settings));
}

