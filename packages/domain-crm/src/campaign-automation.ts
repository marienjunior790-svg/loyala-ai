import type { SupabaseClient } from '@supabase/supabase-js';
import { createCampaign, createCampaignSend } from './campaigns';
import { createNotification } from './notifications';
import { listOrganizationMembers } from './organizations';
import { buildClientRelanceMessage, buildWhatsAppUrl } from './whatsapp';

export interface CampaignPlanPayload {
  clientId: string;
  type: 'birthday' | 'loyalty' | 'promotion';
  content: { message: string; [key: string]: unknown };
}

export interface ClientForCampaign {
  id: string;
  full_name: string;
  phone: string;
  opt_in_whatsapp?: boolean;
}

export function extractCampaignMessage(plan: CampaignPlanPayload): string {
  return plan.content?.message ?? '';
}

export async function listOrgNotifyUserIds(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const members = await listOrganizationMembers(supabase, organizationId);
  const admins = members.filter(
    (m) => m.role_code === 'owner' || m.role_code === 'admin'
  );
  const targets = admins.length > 0 ? admins : members;
  return targets.map((m) => m.user_id);
}

export async function persistCampaignPlans(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    restaurantName: string;
    campaignType: 'inactive' | 'birthday' | 'loyalty';
    campaignName: string;
    plans: CampaignPlanPayload[];
    clients: ClientForCampaign[];
    createdBy?: string | null;
    notifyUserIds?: string[];
    source?: 'manual' | 'cron';
  }
): Promise<{ campaignId: string; sendCount: number }> {
  const clientMap = new Map(params.clients.map((c) => [c.id, c]));
  const eligible = params.plans.filter((plan) => {
    const client = clientMap.get(plan.clientId);
    return client && client.phone && client.opt_in_whatsapp !== false;
  });

  if (eligible.length === 0) {
    return { campaignId: '', sendCount: 0 };
  }

  const preview =
    extractCampaignMessage(eligible[0]!) ||
    `Campagne ${params.campaignType} — ${params.restaurantName}`;

  const campaign = await createCampaign(supabase, params.organizationId, {
    type: params.campaignType,
    name: params.campaignName,
    targetCount: eligible.length,
    messagePreview: preview,
    createdBy: params.createdBy ?? null,
    metadata: { source: params.source ?? 'manual', aiGenerated: true },
  });

  for (const plan of eligible) {
    const client = clientMap.get(plan.clientId)!;
    const aiMsg = extractCampaignMessage(plan);
    const body =
      aiMsg ||
      buildClientRelanceMessage({
        clientName: client.full_name,
        restaurantName: params.restaurantName,
      });
    const url = buildWhatsAppUrl(client.phone, body);
    await createCampaignSend(supabase, params.organizationId, {
      campaignId: campaign.id,
      clientId: client.id,
      messageBody: body,
      whatsappUrl: url,
    });
  }

  const notifyIds =
    params.notifyUserIds ??
    (params.createdBy ? [params.createdBy] : await listOrgNotifyUserIds(supabase, params.organizationId));

  const title =
    params.campaignType === 'birthday'
      ? 'Campagnes anniversaire prêtes'
      : 'Relances inactifs prêtes';
  const body = `${eligible.length} message(s) généré(s) par l'IA — consultez Relances pour envoyer`;

  for (const userId of notifyIds) {
    await createNotification(supabase, {
      organizationId: params.organizationId,
      userId,
      title,
      body,
      type: 'campaign',
      link: '/relances',
    });
  }

  return { campaignId: campaign.id, sendCount: eligible.length };
}
