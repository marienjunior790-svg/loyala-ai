import type { SupabaseClient } from '@supabase/supabase-js';

export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppMessage {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_send_id: string | null;
  wamid: string | null;
  phone: string;
  template_name: string | null;
  message_body: string | null;
  status: WhatsAppMessageStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InsertWhatsAppMessageInput {
  organizationId: string;
  clientId?: string | null;
  campaignSendId?: string | null;
  wamid?: string | null;
  phone: string;
  templateName?: string | null;
  messageBody?: string | null;
  status: WhatsAppMessageStatus;
  sentAt?: string | null;
  errorMessage?: string | null;
  rawPayload?: unknown;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function insertWhatsAppMessage(
  supabase: SupabaseClient,
  input: InsertWhatsAppMessageInput
): Promise<WhatsAppMessage> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      organization_id: input.organizationId,
      client_id: input.clientId ?? null,
      campaign_send_id: input.campaignSendId ?? null,
      wamid: input.wamid ?? null,
      phone: input.phone,
      template_name: input.templateName ?? null,
      message_body: input.messageBody ?? null,
      status: input.status,
      sent_at: input.sentAt ?? (input.status === 'sent' ? new Date().toISOString() : null),
      error_message: input.errorMessage ?? null,
      raw_payload: (input.rawPayload ?? {}) as Record<string, unknown>,
    })
    .select()
    .single();

  assertOk(error);
  return data as WhatsAppMessage;
}

export interface WhatsAppDeliverySnapshot {
  status: WhatsAppMessageStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  wamid: string | null;
  template_name: string | null;
  created_at: string;
}

/** Pure helper — newest row per campaign_send_id wins. */
export function pickLatestDeliveryByCampaignSendId(
  rows: Array<
    WhatsAppDeliverySnapshot & { campaign_send_id: string | null }
  >
): Map<string, WhatsAppDeliverySnapshot> {
  const map = new Map<string, WhatsAppDeliverySnapshot>();
  for (const row of rows) {
    if (!row.campaign_send_id || map.has(row.campaign_send_id)) continue;
    map.set(row.campaign_send_id, {
      status: row.status,
      sent_at: row.sent_at,
      delivered_at: row.delivered_at,
      read_at: row.read_at,
      error_message: row.error_message,
      wamid: row.wamid,
      template_name: row.template_name,
      created_at: row.created_at,
    });
  }
  return map;
}

/**
 * Latest Meta delivery status per campaign_send.
 * Returns empty map if the table is missing (migration 022 not applied) — UI stays usable.
 */
export async function listLatestWhatsAppDeliveryByCampaignSendIds(
  supabase: SupabaseClient,
  organizationId: string,
  campaignSendIds: string[]
): Promise<Map<string, WhatsAppDeliverySnapshot>> {
  if (campaignSendIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select(
      'campaign_send_id, status, sent_at, delivered_at, read_at, error_message, wamid, template_name, created_at'
    )
    .eq('organization_id', organizationId)
    .in('campaign_send_id', campaignSendIds)
    .order('created_at', { ascending: false });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('whatsapp_messages') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist')
    ) {
      return new Map();
    }
    throw new Error(error.message);
  }

  return pickLatestDeliveryByCampaignSendId(
    (data ?? []) as Array<
      WhatsAppDeliverySnapshot & { campaign_send_id: string | null }
    >
  );
}
