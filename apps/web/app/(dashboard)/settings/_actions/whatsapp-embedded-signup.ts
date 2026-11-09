'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { getAdminClient } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getWhatsAppConnectionPublic, type WhatsAppConnectionPublic } from '@loyala/domain-crm';
import {
  completeWhatsAppEmbeddedSignupForOrganization,
  exchangeWhatsAppEmbeddedSignupCode,
  healthCheckWhatsAppConnectionForOrganization,
  subscribeWhatsAppWabaWebhooks,
} from '@loyala/domain-crm/whatsapp-embedded-signup';
import {
  describeEmbeddedSignupCapability,
  resolveMetaAppSecret,
} from '@/lib/whatsapp/embedded-signup-config';
import { finalizeEmbeddedSignupClientResult } from '@/lib/whatsapp/embedded-signup-flow';
import {
  canManageWhatsAppEmbeddedSignup,
  resolveEmbeddedSignupOrganizationId,
} from '@/lib/whatsapp/embedded-signup-policy';
import {
  createWhatsAppEmbeddedSignupState,
  readWhatsAppEmbeddedSignupState,
  WA_ES_OAUTH_COOKIE,
} from '@/lib/whatsapp/embedded-signup-state';

export type EmbeddedSignupActionState = {
  error?: string;
  success?: string;
  connection?: WhatsAppConnectionPublic;
  /** Connexion déjà opérationnelle — pas de relance Meta. */
  alreadyConnected?: boolean;
  /** true uniquement après upsert + health OK — jamais de faux succès. */
  connected?: boolean;
  /** Pour lancer le SDK — jamais de secret. */
  launch?: {
    state: string;
    appId: string;
    configId: string;
    apiVersion: string;
  };
};

function assertCanManage(
  ctx: Awaited<ReturnType<typeof requireAuth>>
): EmbeddedSignupActionState | null {
  if (!canManageWhatsAppEmbeddedSignup(ctx)) {
    return { error: 'Permission refusée — seuls owner/admin gèrent WhatsApp Business' };
  }
  return null;
}

function redactClientError(message: string): string {
  return message
    .replace(/EAA[A-Za-z0-9]+/g, '[token]')
    .replace(/[A-Za-z0-9_-]{48,}/g, '[redacted]')
    .slice(0, 280);
}

/** Prépare state CSRF + paramètres publics pour FB.login. Org = session uniquement. */
export async function beginWhatsAppEmbeddedSignupAction(): Promise<EmbeddedSignupActionState> {
  try {
    const ctx = await requireAuth();
    const denied = assertCanManage(ctx);
    if (denied) return denied;

    const supabase = await createClient();
    const existing = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);
    if (existing.isReady) {
      return {
        success: 'WhatsApp est déjà connecté pour ce restaurant.',
        connection: existing,
        alreadyConnected: true,
        connected: true,
      };
    }

    const capability = describeEmbeddedSignupCapability();
    if (!capability.canLaunch || !capability.publicConfig) {
      return { error: capability.message };
    }

    const { nonce, state } = createWhatsAppEmbeddedSignupState({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });
    const jar = await cookies();
    jar.set(WA_ES_OAUTH_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    return {
      launch: {
        state,
        appId: capability.publicConfig.appId,
        configId: capability.publicConfig.configId,
        apiVersion: capability.publicConfig.apiVersion,
      },
    };
  } catch (e) {
    return {
      error: redactClientError(e instanceof Error ? e.message : 'Impossible de démarrer la connexion Meta'),
    };
  }
}

/**
 * Finalise ES après FB.login.
 * organizationId éventuel du client est ignoré — seule la session compte.
 */
export async function completeWhatsAppEmbeddedSignupAction(input: {
  state: string;
  code: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone?: string;
  /** Ignoré — ne jamais faire confiance au client. */
  organizationId?: string;
}): Promise<EmbeddedSignupActionState> {
  const jar = await cookies();
  const clearCookie = () => {
    jar.set(WA_ES_OAUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  };

  try {
    const ctx = await requireAuth();
    const denied = assertCanManage(ctx);
    if (denied) {
      clearCookie();
      return denied;
    }

    const capability = describeEmbeddedSignupCapability();
    if (!capability.canLaunch || !capability.publicConfig) {
      clearCookie();
      return { error: capability.message };
    }

    const appSecret = resolveMetaAppSecret();
    if (!appSecret) {
      clearCookie();
      return { error: 'Serveur non prêt pour finaliser la connexion Meta.' };
    }

    const nonce = jar.get(WA_ES_OAUTH_COOKIE)?.value ?? '';
    let parsed: ReturnType<typeof readWhatsAppEmbeddedSignupState>;
    try {
      parsed = readWhatsAppEmbeddedSignupState(input.state, nonce);
    } catch {
      clearCookie();
      return { error: 'Session de connexion expirée ou invalide. Réessayez.' };
    }

    if (parsed.organizationId !== ctx.organizationId || parsed.userId !== ctx.userId) {
      clearCookie();
      return { error: 'Session de connexion invalide. Réessayez.' };
    }

    const code = String(input.code ?? '').trim();
    const phoneNumberId = String(input.phoneNumberId ?? '').trim();
    const wabaId = String(input.wabaId ?? '').trim();
    if (!code || !phoneNumberId || !wabaId) {
      clearCookie();
      return { error: 'Autorisation Meta incomplète. Réessayez le parcours guidé.' };
    }

    const exchanged = await exchangeWhatsAppEmbeddedSignupCode({
      code,
      appId: capability.publicConfig.appId,
      appSecret,
      apiVersion: capability.publicConfig.apiVersion,
    });
    if (!exchanged.ok) {
      clearCookie();
      return { error: exchanged.message };
    }

    const expiresAt =
      exchanged.expiresIn && exchanged.expiresIn > 0
        ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString()
        : null;

    const organizationId = resolveEmbeddedSignupOrganizationId(
      ctx.organizationId,
      input.organizationId
    );

    const admin = getAdminClient();
    const connection = await completeWhatsAppEmbeddedSignupForOrganization(admin, {
      organizationId,
      userId: ctx.userId,
      accessToken: exchanged.accessToken,
      phoneNumberId,
      wabaId,
      displayPhone: input.displayPhone,
      tokenExpiresAt: expiresAt,
    });

    // Best-effort webhook subscribe — n’échoue pas l’UI si Meta refuse.
    await subscribeWhatsAppWabaWebhooks({
      wabaId,
      accessToken: exchanged.accessToken,
      apiVersion: capability.publicConfig.apiVersion,
    });

    const health = await healthCheckWhatsAppConnectionForOrganization(admin, organizationId);
    clearCookie();
    revalidatePath('/settings');
    revalidatePath('/clients');

    const supabase = await createClient();
    const publicView = await getWhatsAppConnectionPublic(supabase, organizationId);
    const resolved = publicView.isReady ? publicView : connection;
    const finalized = finalizeEmbeddedSignupClientResult({
      isReady: resolved.isReady,
      healthOk: health.ok,
      healthMessage: health.message,
    });

    return {
      ...finalized,
      connection: resolved,
    };
  } catch (e) {
    clearCookie();
    return {
      error: redactClientError(
        e instanceof Error ? e.message : 'Impossible de finaliser la connexion WhatsApp'
      ),
    };
  }
}
