import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionConfigured,
  type MetaWhatsAppConfig,
} from '@loyala/integrations';

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
    if (/does not exist|relation/i.test(error.message)) return emptyPublic();
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
 * Resolve Meta send config for ONE organization only.
 * Never falls back to another org or a shared env phone/token pair.
 */
export async function getMetaWhatsAppConfigForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<MetaWhatsAppConfig | null> {
  const { data: conn, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'connected')
    .maybeSingle();

  if (error || !conn?.access_token_encrypted) return null;

  const { data: phone } = await supabase
    .from('whatsapp_phone_numbers')
    .select('*')
    .eq('connection_id', conn.id)
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!phone?.phone_number_id || phone.phone_number_id.startsWith('pending:')) return null;

  if (conn.token_expires_at) {
    const exp = new Date(conn.token_expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) {
      await supabase
        .from('whatsapp_connections')
        .update({
          status: 'token_expired',
          last_error: 'Token Meta expiré',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)
        .eq('organization_id', organizationId);
      return null;
    }
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(conn.access_token_encrypted);
  } catch {
    await supabase
      .from('whatsapp_connections')
      .update({
        status: 'error',
        last_error: 'Impossible de déchiffrer le token WhatsApp',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)
      .eq('organization_id', organizationId);
    return null;
  }

  const { data: waba } = await supabase
    .from('whatsapp_business_accounts')
    .select('waba_id')
    .eq('connection_id', conn.id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  return {
    accessToken,
    phoneNumberId: phone.phone_number_id,
    businessAccountId: waba?.waba_id || undefined,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0',
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

export async function upsertWhatsAppConnectionForOrganization(
  supabase: SupabaseClient,
  input: UpsertWhatsAppConnectionInput
): Promise<WhatsAppConnectionPublic> {
  if (!isSecretEncryptionConfigured()) {
    throw new Error(
      'Chiffrement non configuré (LOYALA_SECRETS_ENCRYPTION_KEY). Impossible de stocker le token.'
    );
  }

  const phoneNumberId = input.phoneNumberId.trim();
  const displayPhone = input.displayPhone.trim();
  const wabaId = input.wabaId.trim();
  const accessToken = input.accessToken.trim();

  if (!/^\d{5,30}$/.test(phoneNumberId)) {
    throw new Error('Phone number ID Meta invalide');
  }
  if (displayPhone.length < 6) throw new Error('Numéro WhatsApp invalide');
  if (!/^\d{5,30}$/.test(wabaId)) throw new Error('WhatsApp Business Account ID invalide');
  if (accessToken.length < 20) throw new Error('Access token Meta invalide');

  // Global uniqueness: another org cannot claim this phone_number_id
  const { data: taken } = await supabase
    .from('whatsapp_phone_numbers')
    .select('organization_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();

  if (taken && taken.organization_id !== input.organizationId) {
    throw new Error('Ce numéro WhatsApp est déjà lié à une autre organisation Loyala');
  }

  const { data: wabaTaken } = await supabase
    .from('whatsapp_business_accounts')
    .select('organization_id')
    .eq('waba_id', wabaId)
    .maybeSingle();

  if (wabaTaken && wabaTaken.organization_id !== input.organizationId) {
    throw new Error('Ce compte WhatsApp Business est déjà lié à une autre organisation');
  }

  const now = new Date().toISOString();
  const encrypted = encryptSecret(accessToken);

  const { data: conn, error: connErr } = await supabase
    .from('whatsapp_connections')
    .upsert(
      {
        organization_id: input.organizationId,
        status: 'connected',
        access_token_encrypted: encrypted,
        token_expires_at: input.tokenExpiresAt || null,
        last_synced_at: now,
        last_error: null,
        connected_at: now,
        disconnected_at: null,
        connected_by_user_id: input.userId,
        updated_at: now,
      },
      { onConflict: 'organization_id' }
    )
    .select()
    .single();

  if (connErr || !conn) throw new Error(connErr?.message ?? 'Échec enregistrement connexion');

  const { error: wabaErr } = await supabase.from('whatsapp_business_accounts').upsert(
    {
      connection_id: conn.id,
      organization_id: input.organizationId,
      waba_id: wabaId,
      name: input.accountName?.trim() || null,
      updated_at: now,
    },
    { onConflict: 'connection_id' }
  );
  if (wabaErr) throw new Error(wabaErr.message);

  // Replace primary phone row for this connection
  await supabase
    .from('whatsapp_phone_numbers')
    .delete()
    .eq('connection_id', conn.id)
    .eq('organization_id', input.organizationId);

  const { error: phoneErr } = await supabase.from('whatsapp_phone_numbers').insert({
    connection_id: conn.id,
    organization_id: input.organizationId,
    phone_number_id: phoneNumberId,
    display_phone_number: displayPhone,
    verified_name: input.accountName?.trim() || null,
    is_primary: true,
  });
  if (phoneErr) throw new Error(phoneErr.message);

  // Keep legacy settings in sync for QR / display helpers
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', input.organizationId)
    .single();

  const settings = {
    ...((org?.settings as Record<string, unknown>) ?? {}),
    whatsapp_phone: displayPhone,
    whatsapp_phone_number_id: phoneNumberId,
  };

  await supabase.from('organizations').update({ settings }).eq('id', input.organizationId);

  return getWhatsAppConnectionPublic(supabase, input.organizationId);
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

/** Probe Graph API with the org's own credentials — no shared env token. */
export async function testWhatsAppConnectionForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ ok: boolean; message: string }> {
  const config = await getMetaWhatsAppConfigForOrganization(supabase, organizationId);
  if (!config) {
    return {
      ok: false,
      message: 'WhatsApp Business n’est pas encore connecté (ou token manquant / expiré).',
    };
  }

  const version = (config.apiVersion || 'v21.0').replace(/^v/, 'v');
  const res = await fetch(
    `https://graph.facebook.com/${version}/${config.phoneNumberId}`,
    { headers: { Authorization: `Bearer ${config.accessToken}` } }
  );
  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err =
      (raw as { error?: { message?: string } })?.error?.message ?? res.statusText;
    await markWhatsAppConnectionError(supabase, organizationId, err);
    return { ok: false, message: err };
  }

  await touchWhatsAppConnectionSync(supabase, organizationId);
  const display = String((raw as { display_phone_number?: string }).display_phone_number ?? '');
  return {
    ok: true,
    message: display
      ? `Connexion OK — ${display}`
      : 'Connexion OK — Meta a répondu pour ce Phone number ID',
  };
}
