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

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function phonesMatch(submitted: string, meta: string): boolean {
  const left = digits(submitted);
  const right = digits(meta);
  if (!left || !right) return false;
  const tail = (value: string) => value.slice(-8);
  return left.length >= 8 && right.length >= 8 && tail(left) === tail(right);
}

function safeMetaMessage(message: string, secret?: string): string {
  let safe = message.replace(/EAA[A-Za-z0-9]+/g, '[token]');
  if (secret && secret.length >= 8) safe = safe.split(secret).join('[token]');
  return safe.slice(0, 300);
}

/** Échec exploitable, sans jeton et sans passer le statut à connected. */
async function rememberVerificationFailure(
  supabase: SupabaseClient,
  organizationId: string,
  message: string
): Promise<void> {
  const safe = safeMetaMessage(message);
  try {
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('status')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (existing?.status === 'connected') return;

    await supabase.from('whatsapp_connections').upsert(
      {
        organization_id: organizationId,
        status: 'error',
        last_error: safe,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    );
  } catch {
    // La réponse au client reste le message assaini.
  }
}

export type MetaCredentialProbe =
  | { ok: true; displayPhone: string | null; verifiedName: string | null; accountName: string | null }
  | { ok: false; message: string };

/** Interroge Graph sans envoyer de message. Un échec ne doit jamais être traité comme une connexion. */
export async function verifyMetaWhatsAppCredentials(input: {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaCredentialProbe> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const version = (input.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0').replace(/^v?/, 'v');
  const headers = { Authorization: `Bearer ${input.accessToken}` };

  let phoneRaw: unknown;
  try {
    const phoneRes = await fetchImpl(
      `https://graph.facebook.com/${version}/${input.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers }
    );
    phoneRaw = await phoneRes.json().catch(() => ({}));
    if (!phoneRes.ok) {
      const message =
        (phoneRaw as { error?: { message?: string } })?.error?.message ?? 'Phone number ID refusé par Meta';
      return { ok: false, message: safeMetaMessage(message, input.accessToken) };
    }
  } catch {
    return { ok: false, message: 'Impossible de joindre Meta pour vérifier le Phone number ID' };
  }

  const displayPhone = String((phoneRaw as { display_phone_number?: string }).display_phone_number ?? '');
  const verifiedName = String((phoneRaw as { verified_name?: string }).verified_name ?? '') || null;
  if (!displayPhone || !phonesMatch(input.displayPhone, displayPhone)) {
    return {
      ok: false,
      message: displayPhone
        ? `Le numéro affiché ne correspond pas à celui de Meta (${displayPhone}).`
        : 'Meta n’a pas confirmé le numéro de ce Phone number ID.',
    };
  }

  try {
    const wabaRes = await fetchImpl(
      `https://graph.facebook.com/${version}/${input.wabaId}?fields=id,name`,
      { headers }
    );
    const wabaRaw = await wabaRes.json().catch(() => ({}));
    if (!wabaRes.ok) {
      const message =
        (wabaRaw as { error?: { message?: string } })?.error?.message ??
        'WhatsApp Business Account ID refusé par Meta';
      return { ok: false, message: safeMetaMessage(message, input.accessToken) };
    }
    const accountName = String((wabaRaw as { name?: string }).name ?? '') || null;
    return { ok: true, displayPhone, verifiedName, accountName };
  } catch {
    return { ok: false, message: 'Impossible de joindre Meta pour vérifier le compte WhatsApp Business' };
  }
}

export async function upsertWhatsAppConnectionForOrganization(
  supabase: SupabaseClient,
  input: UpsertWhatsAppConnectionInput & { fetchImpl?: typeof fetch }
): Promise<WhatsAppConnectionPublic> {
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

  const probe = await verifyMetaWhatsAppCredentials({
    accessToken,
    phoneNumberId,
    wabaId,
    displayPhone,
    fetchImpl: input.fetchImpl,
  });
  if (!probe.ok) {
    await rememberVerificationFailure(supabase, input.organizationId, probe.message);
    throw new Error(probe.message);
  }

  if (!isSecretEncryptionConfigured()) {
    throw new Error(
      'Chiffrement non configuré (LOYALA_SECRETS_ENCRYPTION_KEY). Impossible de stocker le token.'
    );
  }

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
      name: input.accountName?.trim() || probe.accountName,
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
    display_phone_number: probe.displayPhone ?? displayPhone,
    verified_name: input.accountName?.trim() || probe.verifiedName,
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
    whatsapp_phone: probe.displayPhone ?? displayPhone,
    whatsapp_phone_number_id: phoneNumberId,
  };

  await supabase.from('organizations').update({ settings }).eq('id', input.organizationId);

  return getWhatsAppConnectionPublic(supabase, input.organizationId);
}

/** Probe Graph API with the org's own credentials — no shared env token. */
export async function testWhatsAppConnectionForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; message: string }> {
  const config = await getMetaWhatsAppConfigForOrganization(supabase, organizationId);
  if (!config) {
    return {
      ok: false,
      message: 'WhatsApp Business n’est pas encore connecté (ou token manquant / expiré).',
    };
  }

  const version = (config.apiVersion || 'v21.0').replace(/^v/, 'v');
  const res = await fetchImpl(`https://graph.facebook.com/${version}/${config.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = safeMetaMessage(
      (raw as { error?: { message?: string } })?.error?.message ?? res.statusText,
      config.accessToken
    );
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
