import type { SupabaseClient } from '@supabase/supabase-js';
import { phoneDigitsForWhatsApp } from '@loyala/integrations/phone';

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ConversationChannel = 'whatsapp' | 'sms' | 'email' | 'rcs' | 'messenger';

export interface ConversationSessionRow {
  id: string;
  organization_id: string;
  client_id: string;
  channel: ConversationChannel;
  external_address: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientPhoneMatch {
  organizationId: string;
  clientId: string;
  phone: string;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Chiffres E.164 sans « + » (format Meta Cloud API) ; même règle que clients.phone_e164. */
export function normalizeAddressForChannel(
  channel: ConversationChannel,
  raw: string,
  country?: string | null
): string {
  if (channel !== 'whatsapp') return raw.replace(/\D/g, '');
  return phoneDigitsForWhatsApp(raw, country);
}

export function isSessionOpen(
  lastInboundAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastInboundAt) return false;
  const inboundMs = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(inboundMs)) return false;
  return nowMs - inboundMs < WHATSAPP_SESSION_WINDOW_MS;
}

export async function fetchConversationSession(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  channel: ConversationChannel = 'whatsapp'
): Promise<ConversationSessionRow | null> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('client_id', clientId)
    .eq('channel', channel)
    .maybeSingle();

  assertOk(error);
  return (data as ConversationSessionRow | null) ?? null;
}

export async function findClientsByWhatsAppAddress(
  supabase: SupabaseClient,
  fromAddress: string,
  opts?: { organizationId?: string }
): Promise<ClientPhoneMatch[]> {
  const normalized = normalizeAddressForChannel('whatsapp', fromAddress);
  if (!normalized) return [];

  const matches = new Map<string, ClientPhoneMatch>();

  let msgQuery = supabase
    .from('whatsapp_messages')
    .select('organization_id, client_id, phone, created_at')
    .eq('phone', normalized)
    .not('client_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (opts?.organizationId) {
    msgQuery = msgQuery.eq('organization_id', opts.organizationId);
  }

  const { data: recentMessages, error: msgError } = await msgQuery;
  assertOk(msgError);

  for (const row of recentMessages ?? []) {
    if (!row.client_id) continue;
    const key = `${row.organization_id}:${row.client_id}`;
    if (!matches.has(key)) {
      matches.set(key, {
        organizationId: String(row.organization_id),
        clientId: String(row.client_id),
        phone: String(row.phone),
      });
    }
  }

  let byE164 = supabase
    .from('clients')
    .select('id, organization_id, phone')
    .is('deleted_at', null)
    .eq('phone_e164', `+${normalized}`)
    .limit(50);
  // Fiches dont le pays du restaurant n'a pas permis de calculer phone_e164.
  let withoutE164 = supabase
    .from('clients')
    .select('id, organization_id, phone')
    .is('deleted_at', null)
    .is('phone_e164', null)
    .not('phone', 'is', null)
    .limit(500);

  if (opts?.organizationId) {
    byE164 = byE164.eq('organization_id', opts.organizationId);
    withoutE164 = withoutE164.eq('organization_id', opts.organizationId);
  }

  const [exact, fallback] = await Promise.all([byE164, withoutE164]);
  assertOk(exact.error);
  assertOk(fallback.error);

  const candidates = [
    ...(exact.data ?? []),
    ...(fallback.data ?? []).filter(
      (client) => normalizeAddressForChannel('whatsapp', String(client.phone ?? '')) === normalized
    ),
  ];

  for (const client of candidates) {
    const key = `${client.organization_id}:${client.id}`;
    if (!matches.has(key)) {
      matches.set(key, {
        organizationId: String(client.organization_id),
        clientId: String(client.id),
        phone: normalized,
      });
    }
  }

  return [...matches.values()];
}

export async function upsertConversationSession(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    clientId: string;
    channel: ConversationChannel;
    externalAddress: string;
    lastInboundAt?: string;
    lastOutboundAt?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ConversationSessionRow> {
  const external_address = normalizeAddressForChannel(params.channel, params.externalAddress);
  const existing = await fetchConversationSession(
    supabase,
    params.organizationId,
    params.clientId,
    params.channel
  );

  const patch = {
    organization_id: params.organizationId,
    client_id: params.clientId,
    channel: params.channel,
    external_address,
    ...(params.lastInboundAt ? { last_inbound_at: params.lastInboundAt } : {}),
    ...(params.lastOutboundAt ? { last_outbound_at: params.lastOutboundAt } : {}),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(params.metadata ?? {}),
    },
  };

  if (existing) {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    assertOk(error);
    return data as ConversationSessionRow;
  }

  const { data, error } = await supabase
    .from('conversation_sessions')
    .insert(patch)
    .select()
    .single();

  assertOk(error);
  return data as ConversationSessionRow;
}

export async function recordOutboundConversationSession(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    clientId: string;
    phone: string;
    channel?: ConversationChannel;
    sentAt?: string;
  }
): Promise<void> {
  await upsertConversationSession(supabase, {
    organizationId: params.organizationId,
    clientId: params.clientId,
    channel: params.channel ?? 'whatsapp',
    externalAddress: params.phone,
    lastOutboundAt: params.sentAt ?? new Date().toISOString(),
  });
}

export interface InboundSessionTouchResult {
  sessionsUpdated: number;
  clientsMatched: number;
}

export async function recordInboundConversationSessions(
  supabase: SupabaseClient,
  params: {
    fromAddress: string;
    inboundAt: string;
    channel?: ConversationChannel;
    metadata?: Record<string, unknown>;
    /** When set, only touch clients in this organization (multi-tenant safe). */
    organizationId?: string;
  }
): Promise<InboundSessionTouchResult & { clients: ClientPhoneMatch[] }> {
  const channel = params.channel ?? 'whatsapp';
  const clients = await findClientsByWhatsAppAddress(supabase, params.fromAddress, {
    organizationId: params.organizationId,
  });

  if (clients.length === 0) {
    return { sessionsUpdated: 0, clientsMatched: 0, clients: [] };
  }

  for (const client of clients) {
    await upsertConversationSession(supabase, {
      organizationId: client.organizationId,
      clientId: client.clientId,
      channel,
      externalAddress: client.phone,
      lastInboundAt: params.inboundAt,
      metadata: params.metadata,
    });
  }

  return { sessionsUpdated: clients.length, clientsMatched: clients.length, clients };
}
