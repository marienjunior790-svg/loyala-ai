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

export async function listReviews(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('organization_id', organizationId)
    .order('reviewed_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
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
): Promise<{ count: number; averageRating: number; pendingResponses: number }> {
  const reviews = await listReviews(supabase, organizationId);
  const count = reviews.length;
  const averageRating =
    count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const pendingResponses = reviews.filter((r) => !r.response_text).length;

  return { count, averageRating, pendingResponses };
}
