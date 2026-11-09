/**
 * Server-only — échange OAuth Embedded Signup + association WABA/Phone.
 * Ne jamais importer depuis un Client Component.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppConnectionPublic } from './whatsapp-connections';
import {
  upsertWhatsAppConnectionForOrganization,
  testWhatsAppConnectionForOrganization,
} from './whatsapp-connections-secure';

function graphVersion(raw?: string): string {
  return (raw || process.env.WHATSAPP_API_VERSION || 'v21.0').replace(/^v?/, 'v');
}

function redactSensitive(message: string, secrets: string[] = []): string {
  let safe = message.replace(/EAA[A-Za-z0-9]+/g, '[token]');
  for (const secret of secrets) {
    if (secret.length >= 8) safe = safe.split(secret).join('[secret]');
  }
  // Codes OAuth longs
  safe = safe.replace(/[A-Za-z0-9_-]{40,}/g, (m) => (m.startsWith('EAA') ? '[token]' : '[redacted]'));
  return safe.slice(0, 280);
}

export type ExchangeEmbeddedSignupCodeResult =
  | { ok: true; accessToken: string; expiresIn: number | null }
  | { ok: false; message: string };

/** Échange le code d’autorisation Meta (serveur uniquement). */
export async function exchangeWhatsAppEmbeddedSignupCode(input: {
  code: string;
  appId: string;
  appSecret: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): Promise<ExchangeEmbeddedSignupCodeResult> {
  const code = input.code.trim();
  const appId = input.appId.trim();
  const appSecret = input.appSecret.trim();
  if (!code || !appId || !appSecret) {
    return { ok: false, message: 'Paramètres d’autorisation incomplets.' };
  }

  const version = graphVersion(input.apiVersion);
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);

  try {
    const res = await fetchImpl(url.toString(), { method: 'GET' });
    const raw = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!res.ok || !raw.access_token) {
      const message = redactSensitive(raw.error?.message ?? 'Échange d’autorisation Meta refusé', [
        appSecret,
        code,
      ]);
      return { ok: false, message };
    }
    return {
      ok: true,
      accessToken: raw.access_token,
      expiresIn: typeof raw.expires_in === 'number' ? raw.expires_in : null,
    };
  } catch {
    return { ok: false, message: 'Impossible de joindre Meta pour finaliser la connexion.' };
  }
}

export type CompleteEmbeddedSignupInput = {
  organizationId: string;
  userId: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone?: string;
  accountName?: string;
  tokenExpiresAt?: string | null;
  fetchImpl?: typeof fetch;
};

/**
 * Valide les actifs Graph puis upsert via le chemin sécurisé canonique.
 * Les conflits multi-tenant sont refusés dans upsertWhatsAppConnectionForOrganization.
 */
export async function completeWhatsAppEmbeddedSignupForOrganization(
  supabase: SupabaseClient,
  input: CompleteEmbeddedSignupInput
): Promise<WhatsAppConnectionPublic> {
  const phoneNumberId = input.phoneNumberId.trim();
  const wabaId = input.wabaId.trim();
  if (!/^\d{5,30}$/.test(phoneNumberId) || !/^\d{5,30}$/.test(wabaId)) {
    throw new Error('Identifiants WhatsApp Business incomplets.');
  }

  let displayPhone = input.displayPhone?.trim() ?? '';
  if (!displayPhone) {
    const version = graphVersion();
    const fetchImpl = input.fetchImpl ?? fetch;
    const res = await fetchImpl(
      `https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${input.accessToken}` } }
    );
    const raw = (await res.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(
        redactSensitive(raw.error?.message ?? 'Numéro WhatsApp inaccessible après autorisation Meta', [
          input.accessToken,
        ])
      );
    }
    displayPhone = String(raw.display_phone_number ?? '').trim();
    if (!displayPhone) {
      throw new Error('Meta n’a pas renvoyé le numéro affiché pour ce compte.');
    }
  }

  return upsertWhatsAppConnectionForOrganization(supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
    displayPhone,
    phoneNumberId,
    wabaId,
    accountName: input.accountName,
    accessToken: input.accessToken,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    fetchImpl: input.fetchImpl,
  });
}

/** Souscription webhook WABA — best-effort, n’échoue pas l’onboarding si Meta refuse. */
export async function subscribeWhatsAppWabaWebhooks(input: {
  wabaId: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; message: string }> {
  const version = graphVersion(input.apiVersion);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${version}/${input.wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    const raw = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok) {
      return {
        ok: false,
        message: redactSensitive(raw.error?.message ?? 'Souscription webhook refusée', [input.accessToken]),
      };
    }
    return { ok: true, message: 'Webhook Meta enregistré pour ce compte.' };
  } catch {
    return { ok: false, message: 'Impossible d’enregistrer le webhook Meta pour le moment.' };
  }
}

/** Health check lecture seule après onboarding. */
export async function healthCheckWhatsAppConnectionForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  fetchImpl?: typeof fetch
): Promise<{ ok: boolean; message: string }> {
  return testWhatsAppConnectionForOrganization(supabase, organizationId, fetchImpl ?? fetch);
}
