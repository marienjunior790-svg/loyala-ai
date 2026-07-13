import type { SupabaseClient } from '@supabase/supabase-js';

export const CAMPAIGN_TYPES = [
  'birthday',
  'inactive',
  'loyalty',
  'promotion',
  'manual',
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = [
  'draft',
  'ready',
  'scheduled',
  'paused',
  'completed',
  'failed',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  organization_id: string;
  type: CampaignType | string;
  name: string;
  status: CampaignStatus | string;
  message_preview: string | null;
  target_count: number;
  metadata: Record<string, unknown>;
  scheduled_at: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
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

export interface CreateCampaignInput {
  type: CampaignType | string;
  name: string;
  messagePreview?: string;
  targetCount?: number;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  status?: CampaignStatus;
  scheduledAt?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  type?: CampaignType | string;
  messagePreview?: string | null;
  targetCount?: number;
  metadata?: Record<string, unknown>;
  status?: CampaignStatus;
  scheduledAt?: string | null;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
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

  assertOk(error);
  return ((data ?? []) as Campaign[]).map((row) => ({
    ...row,
    scheduled_at:
      row.scheduled_at ??
      (typeof row.metadata?.scheduledAt === 'string' ? row.metadata.scheduledAt : null),
    metadata: row.metadata ?? {},
  }));
}

export async function getCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', campaignId)
    .maybeSingle();

  assertOk(error);
  return (data as Campaign | null) ?? null;
}

export async function createCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateCampaignInput
): Promise<Campaign> {
  const baseRow = {
    organization_id: organizationId,
    type: input.type,
    name: input.name,
    status: input.status ?? 'ready',
    message_preview: input.messagePreview ?? null,
    target_count: input.targetCount ?? 0,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    },
    created_by: input.createdBy ?? null,
  };

  const withSchedule = {
    ...baseRow,
    scheduled_at: input.scheduledAt ?? null,
  };

  let { data, error } = await supabase
    .from('campaigns')
    .insert(withSchedule)
    .select()
    .single();

  // Pre-016: no scheduled_at / scheduled|paused statuses.
  if (error && /scheduled|check constraint|column/i.test(error.message)) {
    let legacyStatus: 'draft' | 'ready' | 'completed' | 'failed' = 'ready';
    if (input.status === 'paused' || input.status === 'draft') legacyStatus = 'draft';
    else if (input.status === 'completed' || input.status === 'failed') legacyStatus = input.status;
    else legacyStatus = 'ready';

    const legacy = await supabase
      .from('campaigns')
      .insert({
        ...baseRow,
        status: legacyStatus,
      })
      .select()
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  assertOk(error);
  return data as Campaign;
}

export async function updateCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  input: UpdateCampaignInput
): Promise<Campaign> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.messagePreview !== undefined) patch.message_preview = input.messagePreview;
  if (input.targetCount !== undefined) patch.target_count = input.targetCount;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  if (input.status !== undefined) patch.status = input.status;
  if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;

  let { data, error } = await supabase
    .from('campaigns')
    .update(patch)
    .eq('id', campaignId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error && /scheduled|check constraint|column/i.test(error.message)) {
    const legacyPatch = { ...patch };
    delete legacyPatch.scheduled_at;
    if (legacyPatch.status === 'scheduled') {
      legacyPatch.status = 'ready';
      legacyPatch.metadata = {
        ...((input.metadata as Record<string, unknown> | undefined) ?? {}),
        scheduledAt: input.scheduledAt,
        desiredStatus: 'scheduled',
      };
    }
    if (legacyPatch.status === 'paused') {
      legacyPatch.status = 'draft';
      legacyPatch.metadata = {
        ...((input.metadata as Record<string, unknown> | undefined) ?? {}),
        desiredStatus: 'paused',
      };
    }
    const legacy = await supabase
      .from('campaigns')
      .update(legacyPatch)
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .select()
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  assertOk(error);
  return data as Campaign;
}

export async function deleteCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('organization_id', organizationId);

  assertOk(error);
}

export async function setCampaignStatus(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  status: CampaignStatus
): Promise<Campaign> {
  try {
    return await updateCampaign(supabase, organizationId, campaignId, { status });
  } catch (error) {
    // Pre-016 schema only allows draft|ready|completed|failed.
    const message = error instanceof Error ? error.message : String(error);
    if (!/check constraint|status/i.test(message)) throw error;
    const fallback: CampaignStatus =
      status === 'paused' ? 'draft' : status === 'scheduled' ? 'ready' : status;
    if (fallback === status) throw error;
    const existing = await getCampaign(supabase, organizationId, campaignId);
    return updateCampaign(supabase, organizationId, campaignId, {
      status: fallback,
      metadata: {
        ...(existing?.metadata ?? {}),
        desiredStatus: status,
      },
    });
  }
}

export async function scheduleCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  scheduledAt: string
): Promise<Campaign> {
  const existing = await getCampaign(supabase, organizationId, campaignId);
  if (!existing) throw new Error('Campagne introuvable');

  try {
    return await updateCampaign(supabase, organizationId, campaignId, {
      scheduledAt,
      status: 'scheduled',
      metadata: {
        ...existing.metadata,
        scheduledAt,
      },
    });
  } catch (error) {
    // Pre-016 schema: no scheduled status / scheduled_at column — keep schedule in metadata.
    const message = error instanceof Error ? error.message : String(error);
    if (
      !/scheduled|check constraint|column/i.test(message)
    ) {
      throw error;
    }
    return updateCampaign(supabase, organizationId, campaignId, {
      status: 'ready',
      metadata: {
        ...existing.metadata,
        scheduledAt,
        schedulePendingMigration: true,
      },
    });
  }
}

export async function duplicateCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  createdBy?: string | null
): Promise<Campaign> {
  const source = await getCampaign(supabase, organizationId, campaignId);
  if (!source) throw new Error('Campagne introuvable');

  return createCampaign(supabase, organizationId, {
    type: source.type,
    name: `${source.name} (copie)`,
    messagePreview: source.message_preview ?? undefined,
    targetCount: source.target_count,
    metadata: {
      ...source.metadata,
      duplicatedFrom: source.id,
      source: 'duplicate',
    },
    createdBy: createdBy ?? null,
    status: 'draft',
    scheduledAt: null,
  });
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

  assertOk(error);
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

  assertOk(error);
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

  assertOk(error);
}

export async function markCampaignSendFailed(
  supabase: SupabaseClient,
  organizationId: string,
  sendId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_sends')
    .update({ status: 'failed' })
    .eq('id', sendId)
    .eq('organization_id', organizationId);

  assertOk(error);
}

export async function listPendingCampaignSendsForCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignSend[]> {
  const { data, error } = await supabase
    .from('campaign_sends')
    .select('*, clients(full_name, phone)')
    .eq('organization_id', organizationId)
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  assertOk(error);
  return (data ?? []) as CampaignSend[];
}
