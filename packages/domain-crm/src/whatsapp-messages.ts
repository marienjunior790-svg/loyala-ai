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
