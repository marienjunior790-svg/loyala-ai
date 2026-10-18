import { requireAuthPermission } from '@/lib/auth/guard';
import { MarketingIntelligenceClient } from '@/components/mi/marketing-intelligence-client';

export const dynamic = 'force-dynamic';

/**
 * Marketing Intelligence — Phase 1 L3 (UI consultative).
 * Permission : analytics:read (identique à POST /api/mi/chat).
 */
export default async function MarketingIntelligencePage() {
  await requireAuthPermission('analytics:read');

  return <MarketingIntelligenceClient initialLocale="fr" />;
}
