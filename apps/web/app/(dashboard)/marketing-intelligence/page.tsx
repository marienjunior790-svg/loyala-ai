import { requireAuthPermission } from '@/lib/auth/guard';
import { loadMiOrgInsights, miInsightsForPrompt } from '@loyala/domain-crm';
import { MarketingIntelligenceClient } from '@/components/mi/marketing-intelligence-client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Marketing Intelligence — L3 + P1 cockpit.
 * Permission : analytics:read (identique aux routes MI chat et insights).
 */
export default async function MarketingIntelligencePage() {
  const ctx = await requireAuthPermission('analytics:read');
  const supabase = await createClient();

  let initialInsights: Record<string, unknown> | null = null;
  let initialDataQuality: 'ok' | 'partial' | 'insufficient' | null = null;
  let initialPeriod: {
    code: string;
    label: string;
    from: string;
    to: string;
    definition: string;
  } | null = null;
  let initialError: string | null = null;

  try {
    const organizationId = ctx.organizationId;
    if (!organizationId) {
      initialError = 'Organisation manquante';
    } else {
      const snapshot = await loadMiOrgInsights(supabase, organizationId, {
        period: 'mois',
      });
      if (snapshot.organizationId !== organizationId) {
        initialError = 'Isolation organisation violée';
      } else {
        initialInsights = miInsightsForPrompt(snapshot);
        initialDataQuality = snapshot.dataQuality;
        initialPeriod = snapshot.period;
      }
    }
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Erreur de lecture des données';
  }

  return (
    <MarketingIntelligenceClient
      initialLocale="fr"
      initialInsights={initialInsights}
      initialDataQuality={initialDataQuality}
      initialPeriod={initialPeriod}
      initialError={initialError}
    />
  );
}
