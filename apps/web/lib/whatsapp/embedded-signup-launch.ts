/**
 * Paramètres de lancement Embedded Signup Meta v4 (Facebook Login for Business).
 * Pas de sessionInfoVersion / solutionID / extras.version (legacy v2/v3).
 */
import { loadMetaSdk, type FacebookLoginResponse } from './meta-sdk';

export type EmbeddedSignupSessionAssets = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone?: string;
};

export type EmbeddedSignupLaunchResult =
  | {
      ok: true;
      code: string;
      assets: EmbeddedSignupSessionAssets;
    }
  | { ok: false; reason: 'cancelled' | 'sdk_error' | 'missing_code' | 'missing_assets'; message: string };

type WaEmbeddedSignupMessage = {
  type?: string;
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    current_phone_number_id?: string;
    current_waba_id?: string;
    display_phone_number?: string;
  };
};

function parseAssets(data: WaEmbeddedSignupMessage['data']): EmbeddedSignupSessionAssets | null {
  if (!data) return null;
  const phoneNumberId = String(data.phone_number_id ?? data.current_phone_number_id ?? '').trim();
  const wabaId = String(data.waba_id ?? data.current_waba_id ?? '').trim();
  if (!/^\d{5,30}$/.test(phoneNumberId) || !/^\d{5,30}$/.test(wabaId)) return null;
  const displayPhone = String(data.display_phone_number ?? '').trim() || undefined;
  return { phoneNumberId, wabaId, displayPhone };
}

/**
 * Options FB.login pour WhatsApp Embedded Signup v4.
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4
 */
export function buildEmbeddedSignupLoginOptions(configId: string) {
  return {
    config_id: configId.trim(),
    response_type: 'code' as const,
    override_default_response_type: true as const,
    extras: { setup: {} },
  };
}

/**
 * Lance le flux Meta et attend code OAuth + session WA_EMBEDDED_SIGNUP (FINISH).
 */
export async function launchWhatsAppEmbeddedSignup(input: {
  appId: string;
  configId: string;
  apiVersion: string;
}): Promise<EmbeddedSignupLaunchResult> {
  let assets: EmbeddedSignupSessionAssets | null = null;

  const onMessage = (event: MessageEvent) => {
    if (typeof event.origin !== 'string' || !event.origin.includes('facebook.com')) return;
    let payload: WaEmbeddedSignupMessage | null = null;
    try {
      payload =
        typeof event.data === 'string'
          ? (JSON.parse(event.data) as WaEmbeddedSignupMessage)
          : (event.data as WaEmbeddedSignupMessage);
    } catch {
      return;
    }
    if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
    if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
      assets = parseAssets(payload.data) ?? assets;
    }
  };

  window.addEventListener('message', onMessage);
  try {
    const sdk = await loadMetaSdk({
      appId: input.appId,
      apiVersion: input.apiVersion,
    });

    const loginResponse = await new Promise<FacebookLoginResponse>((resolve) => {
      sdk.login((response) => resolve(response), buildEmbeddedSignupLoginOptions(input.configId));
    });

    const code = loginResponse.authResponse?.code?.trim() ?? '';
    if (!code) {
      if (loginResponse.status === 'unknown' || !loginResponse.authResponse) {
        return {
          ok: false,
          reason: 'cancelled',
          message: 'Connexion Meta annulée. Vous pouvez réessayer.',
        };
      }
      return {
        ok: false,
        reason: 'missing_code',
        message: 'Meta n’a pas renvoyé d’autorisation utilisable. Réessayez ou utilisez la configuration avancée.',
      };
    }

    // Laisser un court délai pour l’événement session (souvent synchrone autour du login).
    await new Promise((r) => window.setTimeout(r, 400));

    if (!assets) {
      return {
        ok: false,
        reason: 'missing_assets',
        message:
          'Meta n’a pas transmis le numéro WhatsApp Business. Terminez le parcours jusqu’à la confirmation, puis réessayez.',
      };
    }

    return { ok: true, code, assets };
  } catch (error) {
    return {
      ok: false,
      reason: 'sdk_error',
      message:
        error instanceof Error
          ? error.message
          : 'Impossible d’ouvrir la connexion Meta. Vérifiez votre réseau et réessayez.',
    };
  } finally {
    window.removeEventListener('message', onMessage);
  }
}
