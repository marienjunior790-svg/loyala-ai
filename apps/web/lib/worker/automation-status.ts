import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkerHealth } from './client';

export interface AutomationStatus {
  workerOnline: boolean;
  workerConfigured: boolean;
  automationsActive: boolean;
  lastBirthdayRun: string | null;
  lastInactiveRun: string | null;
  nextScheduledRun: string;
  campaignsExecuted: number;
  relancesPending: number;
  lastError: string | null;
}

function nextCronUtc(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

/** Métriques métier des automatisations IA (pas d'UUID / nom de service). */
export async function getAutomationStatus(
  supabase: SupabaseClient,
  organizationId: string,
  workerHealth: WorkerHealth
): Promise<AutomationStatus> {
  const [campaignsRes, sendsRes] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, type, created_at, metadata, status')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('campaign_sends')
      .select('id, status, created_at', { count: 'exact', head: false })
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .limit(1),
  ]);

  const campaigns = campaignsRes.data ?? [];
  const aiCampaigns = campaigns.filter(
    (c) =>
      (c.metadata as { aiGenerated?: boolean } | null)?.aiGenerated === true ||
      c.type === 'birthday' ||
      c.type === 'inactive'
  );

  const lastBirthday = aiCampaigns.find((c) => c.type === 'birthday');
  const lastInactive = aiCampaigns.find((c) => c.type === 'inactive');

  const failed = campaigns.find((c) => c.status === 'failed');
  const metaError = failed?.metadata as { error?: string } | null;

  return {
    workerOnline: workerHealth.reachable,
    workerConfigured: workerHealth.configured,
    automationsActive: workerHealth.configured && workerHealth.reachable,
    lastBirthdayRun: lastBirthday?.created_at ?? null,
    lastInactiveRun: lastInactive?.created_at ?? null,
    nextScheduledRun: nextCronUtc(),
    campaignsExecuted: aiCampaigns.length,
    relancesPending: sendsRes.count ?? 0,
    lastError: metaError?.error ?? workerHealth.error ?? null,
  };
}
