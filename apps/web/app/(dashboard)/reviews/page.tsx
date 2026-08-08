import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  listReviews,
  getReviewsSummary,
  getOrganization,
  getGoogleReviewUrl,
  isGoogleReviewAutoRequestEnabled,
} from '@loyala/domain-crm';
import { ReviewsPageClient } from '@/components/reviews/reviews-page-client';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  try {
    const [reviews, summary, org] = await Promise.all([
      listReviews(supabase, ctx.organizationId),
      getReviewsSummary(supabase, ctx.organizationId),
      getOrganization(supabase, ctx.organizationId),
    ]);

    const settings = org?.settings ?? {};
    const googleReviewUrl = getGoogleReviewUrl(settings);

    return (
      <ReviewsPageClient
        reviews={reviews}
        summary={summary}
        googleReviewUrl={googleReviewUrl}
        autoRequestEnabled={isGoogleReviewAutoRequestEnabled(settings)}
      />
    );
  } catch (e) {
    return <ModuleError message={e instanceof Error ? e.message : 'Erreur avis'} />;
  }
}
