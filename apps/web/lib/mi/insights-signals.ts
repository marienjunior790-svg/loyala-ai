import type { MiOrgInsights } from '@loyala/domain-crm';

/** Présence des champs déjà produits par loadMiOrgInsights. null = sauté ou indisponible. */
export function miInsightsSignalsIncluded(
  insights: Pick<
    MiOrgInsights,
    | 'channelMix'
    | 'reviewsInsight'
    | 'recencyLoyalty'
    | 'campaignActivity'
    | 'trends'
    | 'opportunities'
    | 'proactiveBriefing'
  >
) {
  return {
    channelMix: insights.channelMix != null,
    reviewsInsight: insights.reviewsInsight != null,
    recencyLoyalty: insights.recencyLoyalty != null,
    campaignActivity: insights.campaignActivity != null,
    trends: insights.trends != null,
    opportunities: insights.opportunities != null,
    proactiveBriefing: insights.proactiveBriefing != null,
  };
}
