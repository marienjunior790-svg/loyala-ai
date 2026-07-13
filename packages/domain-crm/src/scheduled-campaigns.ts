import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCampaignSend,
  getCampaign,
  updateCampaign,
  type Campaign,
  type CampaignType,
} from './campaigns';
import { listClients, type Client } from './clients';
import {
  listOrgNotifyUserIds,
  extractCampaignMessage,
  type CampaignPlanPayload,
  type ClientForCampaign,
} from './campaign-automation';
import { createNotification } from './notifications';
import { isClientInactive } from './segments';
import { buildClientRelanceMessage, buildWhatsAppUrl } from './whatsapp';

const AI_CAMPAIGN_TYPES = new Set<CampaignType | string>(['birthday', 'inactive', 'loyalty']);

export function resolveCampaignScheduledAt(campaign: Campaign): string | null {
  if (campaign.scheduled_at) return campaign.scheduled_at;
  const meta = campaign.metadata ?? {};
  return typeof meta.scheduledAt === 'string' ? meta.scheduledAt : null;
}

/** Whether a user-scheduled campaign is due for execution. */
export function isCampaignDue(campaign: Campaign, asOf: Date = new Date()): boolean {
  const scheduledAt = resolveCampaignScheduledAt(campaign);
  if (!scheduledAt) return false;

  const dueTime = Date.parse(scheduledAt);
  if (Number.isNaN(dueTime) || dueTime > asOf.getTime()) return false;

  if (campaign.status === 'scheduled') return true;

  if (campaign.status === 'ready') {
    const meta = campaign.metadata ?? {};
    return Boolean(meta.schedulePendingMigration || meta.desiredStatus === 'scheduled');
  }

  return false;
}

function normalizeCampaign(row: Campaign): Campaign {
  return {
    ...row,
    scheduled_at: resolveCampaignScheduledAt(row),
    metadata: row.metadata ?? {},
  };
}

export async function listDueScheduledCampaigns(
  supabase: SupabaseClient,
  asOf: Date = new Date()
): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .in('status', ['scheduled', 'ready'])
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Campaign[])
    .map(normalizeCampaign)
    .filter((campaign) => isCampaignDue(campaign, asOf));
}

export async function countCampaignSends(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('campaign_sends')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('campaign_id', campaignId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

function toClientForCampaign(client: Client): ClientForCampaign {
  return {
    id: client.id,
    full_name: client.full_name,
    phone: client.phone,
    opt_in_whatsapp: client.opt_in_whatsapp,
  };
}

export async function appendBroadcastCampaignSends(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    campaignId: string;
    restaurantName: string;
    messageBody: string;
    clients?: ClientForCampaign[];
  }
): Promise<number> {
  const clients =
    params.clients ??
    (await listClients(supabase, params.organizationId))
      .filter((c) => c.opt_in_whatsapp && c.phone)
      .map(toClientForCampaign);

  const eligible = clients.filter((c) => c.phone && c.opt_in_whatsapp !== false);
  let sendCount = 0;

  for (const client of eligible) {
    const body =
      params.messageBody.trim() ||
      buildClientRelanceMessage({
        clientName: client.full_name,
        restaurantName: params.restaurantName,
      });
    await createCampaignSend(supabase, params.organizationId, {
      campaignId: params.campaignId,
      clientId: client.id,
      messageBody: body,
      whatsappUrl: buildWhatsAppUrl(client.phone, body),
    });
    sendCount += 1;
  }

  return sendCount;
}

export async function appendCampaignSendsFromPlans(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    campaignId: string;
    restaurantName: string;
    plans: CampaignPlanPayload[];
    clients: ClientForCampaign[];
  }
): Promise<number> {
  const clientMap = new Map(params.clients.map((c) => [c.id, c]));
  let sendCount = 0;

  for (const plan of params.plans) {
    const client = clientMap.get(plan.clientId);
    if (!client?.phone || client.opt_in_whatsapp === false) continue;

    const aiMsg = extractCampaignMessage(plan);
    const body =
      aiMsg ||
      buildClientRelanceMessage({
        clientName: client.full_name,
        restaurantName: params.restaurantName,
      });

    await createCampaignSend(supabase, params.organizationId, {
      campaignId: params.campaignId,
      clientId: client.id,
      messageBody: body,
      whatsappUrl: buildWhatsAppUrl(client.phone, body),
    });
    sendCount += 1;
  }

  return sendCount;
}

export function filterClientsForScheduledType(
  type: CampaignType | string,
  clients: Client[]
): Client[] {
  if (type === 'birthday') {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return clients.filter((c) => {
      if (!c.date_of_birth) return false;
      const dob = new Date(c.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });
  }

  if (type === 'inactive' || type === 'loyalty') {
    return clients.filter((c) => isClientInactive(c));
  }

  return clients;
}

export function usesAiGenerationForType(type: CampaignType | string): boolean {
  return AI_CAMPAIGN_TYPES.has(type);
}

export async function notifyScheduledCampaignExecuted(
  supabase: SupabaseClient,
  organizationId: string,
  sendCount: number,
  campaignName: string
): Promise<void> {
  const notifyIds = await listOrgNotifyUserIds(supabase, organizationId);
  const title = 'Campagne planifiée exécutée';
  const body = `${sendCount} message(s) pour « ${campaignName} » — consultez Relances pour envoyer`;

  for (const userId of notifyIds) {
    await createNotification(supabase, {
      organizationId,
      userId,
      title,
      body,
      type: 'campaign',
      link: '/relances',
    });
  }
}

export async function finalizeScheduledCampaignExecution(
  supabase: SupabaseClient,
  organizationId: string,
  campaign: Campaign,
  sendCount: number,
  extraMetadata: Record<string, unknown> = {}
): Promise<Campaign> {
  const executedAt = new Date().toISOString();

  if (sendCount === 0) {
    return updateCampaign(supabase, organizationId, campaign.id, {
      status: 'failed',
      scheduledAt: null,
      metadata: {
        ...campaign.metadata,
        ...extraMetadata,
        executedAt,
        error: 'no_eligible_clients',
      },
    });
  }

  return updateCampaign(supabase, organizationId, campaign.id, {
    status: 'completed',
    targetCount: sendCount,
    scheduledAt: null,
    metadata: {
      ...campaign.metadata,
      ...extraMetadata,
      executedAt,
      schedulePendingMigration: undefined,
      desiredStatus: undefined,
    },
  });
}

export async function markScheduledCampaignExecutionFailed(
  supabase: SupabaseClient,
  organizationId: string,
  campaign: Campaign,
  errorMessage: string
): Promise<Campaign> {
  return updateCampaign(supabase, organizationId, campaign.id, {
    status: 'failed',
    scheduledAt: null,
    metadata: {
      ...campaign.metadata,
      executedAt: new Date().toISOString(),
      error: errorMessage,
    },
  });
}

export async function getScheduledCampaignForExecution(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(supabase, organizationId, campaignId);
  if (!campaign) return null;
  return normalizeCampaign(campaign);
}
