/**
 * Server/worker only — uses Node crypto to encrypt Meta tokens.
 * Do not import from client components (not re-exported by @loyala/domain-crm barrel).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetaWhatsAppConfig } from '@loyala/integrations';
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionConfigured,
} from '@loyala/integrations/crypto/secrets';
import {
  getWhatsAppConnectionPublic,
  markWhatsAppConnectionError,
  touchWhatsAppConnectionSync,
  type UpsertWhatsAppConnectionInput,
  type WhatsAppConnectionPublic,
} from './whatsapp-connections';

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
  const res = await fetch(`https://graph.facebook.com/${version}/${config.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
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
