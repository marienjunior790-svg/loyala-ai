import type { SupabaseClient } from '@supabase/supabase-js';

export interface Campaign {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  status: string;
  message_preview: string | null;
  target_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CampaignSend {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  client_id: string | null;
  channel: string;
  message_body: string;
  status: string;
  whatsapp_url: string | null;
  sent_at: string | null;
  created_at: string;
  clients?: { full_name: string; phone: string } | null;
}

export async function listCampaigns(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

export async function createCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    type: Campaign['type'];
    name: string;
    messagePreview?: string;
    targetCount?: number;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: organizationId,
      type: input.type,
      name: input.name,
      status: 'ready',
      message_preview: input.messagePreview ?? null,
      target_count: input.targetCount ?? 0,
      metadata: input.metadata ?? {},
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function listCampaignSends(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50
): Promise<CampaignSend[]> {
  const { data, error } = await supabase
    .from('campaign_sends')
    .select('*, clients(full_name, phone)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignSend[];
}

export async function createCampaignSend(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    campaignId?: string;
    clientId: string;
    messageBody: string;
    whatsappUrl: string;
    status?: 'pending' | 'sent';
  }
): Promise<CampaignSend> {
  const { data, error } = await supabase
    .from('campaign_sends')
    .insert({
      organization_id: organizationId,
      campaign_id: input.campaignId ?? null,
      client_id: input.clientId,
      channel: 'whatsapp',
      message_body: input.messageBody,
      whatsapp_url: input.whatsappUrl,
      status: input.status ?? 'pending',
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CampaignSend;
}

export async function markCampaignSendSent(
  supabase: SupabaseClient,
  organizationId: string,
  sendId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_sends')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', sendId)
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
}
