import type { SupabaseClient } from '@supabase/supabase-js';

export type WhatsAppConnectionStatus =
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'token_expired'
  | 'disconnected';

export const WHATSAPP_CONNECTION_STATUS_LABELS: Record<WhatsAppConnectionStatus, string> = {
  not_connected: 'Non connecté',
  connecting: 'Connexion en cours',
  connected: 'Connecté',
  error: 'Erreur',
  token_expired: 'Token expiré',
  disconnected: 'Déconnecté',
};

export interface WhatsAppPhoneNumberRow {
  id: string;
  connection_id: string;
  organization_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  is_primary: boolean;
}

export interface WhatsAppBusinessAccountRow {
  id: string;
  connection_id: string;
  organization_id: string;
  waba_id: string;
  name: string | null;
}

export interface WhatsAppConnectionRow {
  id: string;
  organization_id: string;
  status: WhatsAppConnectionStatus;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  connected_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Safe public view — never includes tokens. */
export interface WhatsAppConnectionPublic {
  connectionId: string | null;
  status: WhatsAppConnectionStatus;
  statusLabel: string;
  accountName: string | null;
  displayPhone: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  hasToken: boolean;
  isReady: boolean;
}

export interface UpsertWhatsAppConnectionInput {
  organizationId: string;
  userId: string;
  displayPhone: string;
  phoneNumberId: string;
  wabaId: string;
  accountName?: string;
  accessToken: string;
  tokenExpiresAt?: string | null;
}

function emptyPublic(): WhatsAppConnectionPublic {
  return {
    connectionId: null,
    status: 'not_connected',
    statusLabel: WHATSAPP_CONNECTION_STATUS_LABELS.not_connected,
    accountName: null,
    displayPhone: null,
    wabaId: null,
    phoneNumberId: null,
    lastSyncedAt: null,
    lastError: null,
    connectedAt: null,
    hasToken: false,
    isReady: false,
  };
}

export async function getWhatsAppConnectionPublic(
  supabase: SupabaseClient,
  organizationId: string
): Promise<WhatsAppConnectionPublic> {
  const { data: conn, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    // PostgREST: missing table / schema cache not yet refreshed after migration
    if (/does not exist|relation|schema cache|could not find the table/i.test(error.message)) {
      return emptyPublic();
    }
    throw new Error(error.message);
  }
  if (!conn) return emptyPublic();

  const [{ data: phone }, { data: waba }] = await Promise.all([
    supabase
      .from('whatsapp_phone_numbers')
      .select('*')
      .eq('connection_id', conn.id)
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('whatsapp_business_accounts')
      .select('*')
      .eq('connection_id', conn.id)
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  const status = conn.status as WhatsAppConnectionStatus;
  const hasToken = Boolean(conn.access_token_encrypted);
  const phoneNumberId = phone?.phone_number_id?.startsWith('pending:')
    ? null
    : phone?.phone_number_id ?? null;

  return {
    connectionId: conn.id,
    status,
    statusLabel: WHATSAPP_CONNECTION_STATUS_LABELS[status] ?? status,
    accountName: waba?.name ?? phone?.verified_name ?? null,
    displayPhone: phone?.display_phone_number ?? null,
    wabaId: waba?.waba_id ?? null,
    phoneNumberId,
    lastSyncedAt: conn.last_synced_at,
    lastError: conn.last_error,
    connectedAt: conn.connected_at,
    hasToken,
    isReady: status === 'connected' && hasToken && Boolean(phoneNumberId),
  };
}

/**
 * Webhook routing: phone_number_id → organization.
 * Never trusts a client-supplied organizationId.
 */
export async function resolveOrganizationIdForWhatsAppPhoneNumberId(
  supabase: SupabaseClient,
  phoneNumberId: string | undefined
): Promise<string | null> {
  if (!phoneNumberId) return null;

  const { data, error } = await supabase
    .from('whatsapp_phone_numbers')
    .select('organization_id, connection_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      return resolveOrganizationFromLegacySettings(supabase, phoneNumberId);
    }
    throw new Error(error.message);
  }
  if (!data?.organization_id) {
    return resolveOrganizationFromLegacySettings(supabase, phoneNumberId);
  }

  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('status')
    .eq('id', data.connection_id)
    .eq('organization_id', data.organization_id)
    .maybeSingle();

  if (!conn || conn.status === 'disconnected' || conn.status === 'not_connected') {
    return null;
  }

  return String(data.organization_id);
}

/** Temporary bridge until all orgs migrate settings → connections table. */
async function resolveOrganizationFromLegacySettings(
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<string | null> {
  const { data, error } = await supabase.from('organizations').select('id, settings');
  if (error) throw new Error(error.message);

  const matched = (data ?? []).filter((row) => {
    const settings = (row.settings as Record<string, unknown>) ?? {};
    return String(settings.whatsapp_phone_number_id ?? '') === phoneNumberId;
  });

  // Strict: exactly one org may own this phone number id
  if (matched.length === 1) return String(matched[0]!.id);
  return null;
}

export async function disconnectWhatsAppConnection(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('whatsapp_connections')
    .update({
      status: 'disconnected',
      access_token_encrypted: null,
      last_error: null,
      disconnected_at: now,
      updated_at: now,
    })
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
}

export async function markWhatsAppConnectionError(
  supabase: SupabaseClient,
  organizationId: string,
  message: string
): Promise<void> {
  await supabase
    .from('whatsapp_connections')
    .update({
      status: 'error',
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId);
}

export async function touchWhatsAppConnectionSync(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  await supabase
    .from('whatsapp_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('organization_id', organizationId)
    .eq('status', 'connected');
}
