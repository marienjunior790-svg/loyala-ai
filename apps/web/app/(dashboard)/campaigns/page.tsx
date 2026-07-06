import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listCampaigns } from '@loyala/domain-crm';
import { getWorkerHealth } from '@/lib/worker/client';
import { CampaignsPageClient } from '@/components/campaigns/campaigns-page-client';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const workerHealth = await getWorkerHealth();

  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = [];
  let error: string | null = null;

  try {
    campaigns = await listCampaigns(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Chargement impossible';
  }

  return (
    <CampaignsPageClient
      campaigns={campaigns}
      workerHealth={workerHealth}
      organizationId={ctx.organizationId}
      error={error}
    />
  );
}
