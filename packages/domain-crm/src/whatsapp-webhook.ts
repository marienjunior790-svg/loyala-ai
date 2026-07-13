import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppMessageStatus } from './whatsapp-messages';

export interface MetaWebhookStatus {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  recipientId?: string;
  errorMessage?: string;
  raw: unknown;
}

export type ApplyWebhookResult = 'updated' | 'skipped' | 'not_found' | 'duplicate';

export interface WebhookHistoryEntry {
  status: string;
  timestamp?: string;
  processedAt: string;
}

export interface ValidateMetaWebhookResult {
  valid: boolean;
  reason?: string;
}

/** Structural validation before processing (signature checked separately). */
export function validateMetaWebhookPayload(payload: unknown): ValidateMetaWebhookResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'payload_not_object' };
  }

  const object = String((payload as { object?: string }).object ?? '');
  if (object !== 'whatsapp_business_account') {
    return { valid: false, reason: 'invalid_object_type' };
  }

  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) {
    return { valid: false, reason: 'missing_entry_array' };
  }

  return { valid: true };
}

const STATUS_RANK: Record<WhatsAppMessageStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 99,
};

function toIsoTimestamp(seconds?: string): string | undefined {
  if (!seconds) return undefined;
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000).toISOString();
}

function mapMetaStatus(status: string): MetaWebhookStatus['status'] | null {
  const normalized = status.toLowerCase();
  if (normalized === 'sent') return 'sent';
  if (normalized === 'delivered') return 'delivered';
  if (normalized === 'read') return 'read';
  if (normalized === 'failed') return 'failed';
  return null;
}

/** Extract message status updates from a Meta WhatsApp webhook payload. */
export function parseMetaWebhookStatuses(payload: unknown): MetaWebhookStatus[] {
  if (!payload || typeof payload !== 'object') return [];
  const object = String((payload as { object?: string }).object ?? '');
  if (object !== 'whatsapp_business_account') return [];

  const entries = (payload as { entry?: unknown[] }).entry ?? [];
  const results: MetaWebhookStatus[] = [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const statuses = (value.statuses as unknown[]) ?? [];
      for (const item of statuses) {
        const row = item as Record<string, unknown>;
        const wamid = String(row.id ?? '').trim();
        const mapped = mapMetaStatus(String(row.status ?? ''));
        if (!wamid || !mapped) continue;

        const errors = (row.errors as Array<Record<string, unknown>> | undefined) ?? [];
        const firstError = errors[0];
        const errorMessage = firstError
          ? String(firstError.title ?? firstError.message ?? 'Delivery failed')
          : undefined;

        results.push({
          wamid,
          status: mapped,
          timestamp: toIsoTimestamp(String(row.timestamp ?? '')),
          recipientId: row.recipient_id ? String(row.recipient_id) : undefined,
          errorMessage,
          raw: item,
        });
      }
    }
  }

  return dedupeStatuses(results);
}

function dedupeStatuses(statuses: MetaWebhookStatus[]): MetaWebhookStatus[] {
  const seen = new Set<string>();
  const unique: MetaWebhookStatus[] = [];
  for (const status of statuses) {
    const key = `${status.wamid}:${status.status}:${status.timestamp ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(status);
  }
  return unique;
}

/** Parse and dedupe status events from a validated Meta webhook payload. */
export function parseAndDedupeMetaWebhookStatuses(payload: unknown): MetaWebhookStatus[] {
  return parseMetaWebhookStatuses(payload);
}

function getWebhookHistory(raw: Record<string, unknown>): WebhookHistoryEntry[] {
  const history = raw.webhookHistory;
  return Array.isArray(history) ? (history as WebhookHistoryEntry[]) : [];
}

export function isDuplicateWebhookEvent(
  rawPayload: Record<string, unknown>,
  update: MetaWebhookStatus
): boolean {
  return getWebhookHistory(rawPayload).some(
    (entry) => entry.status === update.status && entry.timestamp === update.timestamp
  );
}

function shouldApplyStatus(
  current: WhatsAppMessageStatus,
  incoming: MetaWebhookStatus['status'],
  isDuplicate: boolean
): boolean {
  if (isDuplicate) return false;
  if (incoming === 'failed') return current !== 'failed';
  const currentRank = STATUS_RANK[current] ?? 0;
  const incomingRank = STATUS_RANK[incoming] ?? 0;
  return incomingRank > currentRank;
}

export async function applyMetaWebhookStatus(
  supabase: SupabaseClient,
  update: MetaWebhookStatus
): Promise<ApplyWebhookResult> {
  const { data: existing, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('id, status, raw_payload, campaign_send_id, organization_id')
    .eq('wamid', update.wamid)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return 'not_found';

  const rawPayload = (existing.raw_payload as Record<string, unknown>) ?? {};
  const duplicate = isDuplicateWebhookEvent(rawPayload, update);
  if (duplicate) return 'duplicate';

  const currentStatus = String(existing.status) as WhatsAppMessageStatus;
  if (!shouldApplyStatus(currentStatus, update.status, duplicate)) {
    return 'skipped';
  }

  const processedAt = new Date().toISOString();
  const historyEntry: WebhookHistoryEntry = {
    status: update.status,
    timestamp: update.timestamp,
    processedAt,
  };

  const patch: Record<string, unknown> = {
    status: update.status,
    raw_payload: {
      ...rawPayload,
      lastWebhook: update.raw,
      webhookHistory: [...getWebhookHistory(rawPayload), historyEntry],
    },
  };

  if (update.status === 'sent' && update.timestamp) patch.sent_at = update.timestamp;
  if (update.status === 'delivered' && update.timestamp) patch.delivered_at = update.timestamp;
  if (update.status === 'read' && update.timestamp) patch.read_at = update.timestamp;
  if (update.status === 'failed') {
    patch.error_message = update.errorMessage ?? 'Delivery failed';
  }

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update(patch)
    .eq('id', existing.id);

  if (updateError) throw new Error(updateError.message);

  if (update.status === 'failed' && existing.campaign_send_id) {
    await supabase
      .from('campaign_sends')
      .update({ status: 'failed' })
      .eq('id', existing.campaign_send_id)
      .eq('organization_id', existing.organization_id);
  }

  return 'updated';
}
