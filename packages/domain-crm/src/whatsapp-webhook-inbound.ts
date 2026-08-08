import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeAddressForChannel,
  recordInboundConversationSessions,
  type InboundSessionTouchResult,
} from './conversation-sessions';
import {
  parseAcquisitionSourceFromMessage,
  resolveOrganizationsForWhatsAppPhoneNumberId,
  upsertWhatsAppLead,
} from './acquisition';

export interface MetaWebhookInboundMessage {
  wamid: string;
  from: string;
  timestamp: string;
  type: string;
  body?: string;
  profileName?: string;
  phoneNumberId?: string;
  raw: unknown;
}

function toIsoTimestamp(seconds?: string): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

/** Extract inbound user messages from a Meta WhatsApp webhook payload. */
export function parseMetaWebhookInboundMessages(payload: unknown): MetaWebhookInboundMessage[] {
  if (!payload || typeof payload !== 'object') return [];
  const object = String((payload as { object?: string }).object ?? '');
  if (object !== 'whatsapp_business_account') return [];

  const entries = (payload as { entry?: unknown[] }).entry ?? [];
  const results: MetaWebhookInboundMessage[] = [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const phoneNumberId = (value.metadata as { phone_number_id?: string } | undefined)
        ?.phone_number_id;
      const contacts = (value.contacts as unknown[]) ?? [];
      const profileByWaId = new Map<string, string>();
      for (const c of contacts) {
        const row = c as { wa_id?: string; profile?: { name?: string } };
        if (row.wa_id && row.profile?.name) {
          profileByWaId.set(String(row.wa_id), String(row.profile.name));
        }
      }
      const messages = (value.messages as unknown[]) ?? [];

      for (const item of messages) {
        const row = item as Record<string, unknown>;
        const wamid = String(row.id ?? '').trim();
        const from = String(row.from ?? '').trim();
        const type = String(row.type ?? 'unknown');
        if (!wamid || !from) continue;

        let body: string | undefined;
        if (type === 'text') {
          body = String((row.text as { body?: string } | undefined)?.body ?? '').trim() || undefined;
        }

        results.push({
          wamid,
          from,
          timestamp: toIsoTimestamp(String(row.timestamp ?? '')),
          type,
          body,
          profileName: profileByWaId.get(from),
          phoneNumberId: phoneNumberId ? String(phoneNumberId) : undefined,
          raw: item,
        });
      }
    }
  }

  return dedupeInbound(results);
}

function dedupeInbound(messages: MetaWebhookInboundMessage[]): MetaWebhookInboundMessage[] {
  const seen = new Set<string>();
  const unique: MetaWebhookInboundMessage[] = [];
  for (const message of messages) {
    const key = `${message.wamid}:${message.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(message);
  }
  return unique;
}

/**
 * Process inbound Meta messages with strict tenant isolation:
 * phone_number_id → WhatsAppPhoneNumber → Connection → organizationId
 * Never trusts a client-supplied organizationId.
 */
export async function applyMetaWebhookInboundMessages(
  supabase: SupabaseClient,
  messages: MetaWebhookInboundMessage[]
): Promise<
  InboundSessionTouchResult & {
    processed: number;
    skipped: number;
    leadsUpserted: number;
    matched: Array<{ organizationId: string; clientId: string; wamid: string }>;
  }
> {
  let sessionsUpdated = 0;
  let clientsMatched = 0;
  let skipped = 0;
  let leadsUpserted = 0;
  const matched: Array<{ organizationId: string; clientId: string; wamid: string }> = [];

  for (const message of messages) {
    const normalizedFrom = normalizeAddressForChannel('whatsapp', message.from);
    if (!normalizedFrom) {
      skipped += 1;
      continue;
    }

    const orgIds = await resolveOrganizationsForWhatsAppPhoneNumberId(
      supabase,
      message.phoneNumberId
    );
    const organizationId = orgIds[0];
    if (!organizationId) {
      skipped += 1;
      continue;
    }

    const result = await recordInboundConversationSessions(supabase, {
      fromAddress: message.from,
      inboundAt: message.timestamp,
      channel: 'whatsapp',
      organizationId,
      metadata: {
        lastInboundWamid: message.wamid,
        lastInboundType: message.type,
        ...(message.body ? { lastInboundPreview: message.body.slice(0, 200) } : {}),
        ...(message.phoneNumberId ? { phoneNumberId: message.phoneNumberId } : {}),
      },
    });

    if (result.sessionsUpdated > 0) {
      sessionsUpdated += result.sessionsUpdated;
      clientsMatched += result.clientsMatched;
      for (const client of result.clients) {
        if (client.organizationId !== organizationId) continue;
        matched.push({
          organizationId: client.organizationId,
          clientId: client.clientId,
          wamid: message.wamid,
        });
      }
      continue;
    }

    const source = parseAcquisitionSourceFromMessage(message.body);
    const lead = await upsertWhatsAppLead(supabase, {
      organizationId,
      phone: message.from,
      profileName: message.profileName,
      preview: message.body,
      wamid: message.wamid,
      inboundAt: message.timestamp,
      acquisitionSource: source,
    });
    if (lead) leadsUpserted += 1;
  }

  return {
    processed: messages.length,
    skipped,
    leadsUpserted,
    sessionsUpdated,
    clientsMatched,
    matched,
  };
}
