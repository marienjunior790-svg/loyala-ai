import { ModuleError } from '@/components/dashboard/module-error';
import { CampaignsPageClient } from '@/components/campaigns/campaigns-page-client';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getWorkerHealth } from '@/lib/worker/client';
import { getAutomationStatus } from '@/lib/worker/automation-status';
import { listCampaigns } from '@loyala/domain-crm';

export const dynamic = 'force-dynamic';

function isNextControlFlowError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const digest = 'digest' in error ? String((error as { digest?: unknown }).digest ?? '') : '';
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND');
}

export default async function CampaignsPage() {
  try {
    const ctx = await requireAuth();
    const supabase = await createClient();
    const workerHealth = await getWorkerHealth();
    const automationStatus = await getAutomationStatus(supabase, ctx.organizationId, workerHealth);

    let campaigns: Awaited<ReturnType<typeof listCampaigns>> = [];
    let listError: string | null = null;

    try {
      campaigns = await listCampaigns(supabase, ctx.organizationId);
    } catch (e) {
      listError = e instanceof Error ? e.message : 'Chargement impossible';
    }

    return (
      <CampaignsPageClient
        campaigns={campaigns}
        automationStatus={automationStatus}
        error={listError}
        canWrite={['org_owner', 'org_admin', 'org_manager', 'org_staff'].includes(ctx.role)}
      />
    );
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return (
      <ModuleError message={e instanceof Error ? e.message : 'Erreur chargement campagnes'} />
    );
  }
}
