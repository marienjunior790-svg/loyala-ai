/**
 * Configuration publique / capacité Embedded Signup (Meta v4).
 * Ne renvoie jamais de secret au client.
 */

export type EmbeddedSignupReadiness =
  | 'unavailable'
  | 'not_configured'
  | 'server_not_ready'
  | 'ready_to_launch';

export type EmbeddedSignupPublicConfig = {
  appId: string;
  configId: string;
  apiVersion: string;
};

export type EmbeddedSignupCapability = {
  readiness: EmbeddedSignupReadiness;
  canLaunch: boolean;
  message: string;
  /** Uniquement si canLaunch — valeurs publiques Meta. */
  publicConfig: EmbeddedSignupPublicConfig | null;
};

export type EmbeddedSignupEnv = {
  NEXT_PUBLIC_META_APP_ID?: string;
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
  /** Version Graph optionnelle (ex. v21.0). */
  NEXT_PUBLIC_META_GRAPH_API_VERSION?: string;
  WHATSAPP_API_VERSION?: string;
  /** Canonique App Secret plateforme (webhook + OAuth exchange). */
  WHATSAPP_APP_SECRET?: string;
  /** Alias accepté si WHATSAPP_APP_SECRET est vide. */
  META_APP_SECRET?: string;
  LOYALA_SECRETS_ENCRYPTION_KEY?: string;
  WHATSAPP_TOKEN_ENCRYPTION_KEY?: string;
  [key: string]: string | undefined;
};

function trim(value: string | undefined): string {
  return value?.trim() ?? '';
}

/** Source canonique du secret App Meta côté serveur. */
export function resolveMetaAppSecret(env: EmbeddedSignupEnv = process.env): string | null {
  const secret = trim(env.WHATSAPP_APP_SECRET) || trim(env.META_APP_SECRET);
  return secret || null;
}

export function isMetaEncryptionConfigured(env: EmbeddedSignupEnv = process.env): boolean {
  return Boolean(trim(env.LOYALA_SECRETS_ENCRYPTION_KEY) || trim(env.WHATSAPP_TOKEN_ENCRYPTION_KEY));
}

export function readEmbeddedSignupPublicConfig(
  env: EmbeddedSignupEnv = process.env
): EmbeddedSignupPublicConfig | null {
  const appId = trim(env.NEXT_PUBLIC_META_APP_ID);
  const configId = trim(env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID);
  if (!appId || !configId) return null;
  const apiVersion = (
    trim(env.NEXT_PUBLIC_META_GRAPH_API_VERSION) ||
    trim(env.WHATSAPP_API_VERSION) ||
    'v21.0'
  ).replace(/^v?/, 'v');
  return { appId, configId, apiVersion };
}

/**
 * Calcule la capacité ES. À appeler côté serveur (page / action)
 * pour inclure secret + chiffrement sans les exposer.
 */
export function describeEmbeddedSignupCapability(
  env: EmbeddedSignupEnv = process.env
): EmbeddedSignupCapability {
  const publicConfig = readEmbeddedSignupPublicConfig(env);
  if (!publicConfig) {
    return {
      readiness: 'not_configured',
      canLaunch: false,
      message:
        'La connexion guidée Meta n’est pas configurée. Un administrateur Loyala doit renseigner l’App ID et le Configuration ID publics.',
      publicConfig: null,
    };
  }

  const appSecret = resolveMetaAppSecret(env);
  const encryption = isMetaEncryptionConfigured(env);
  if (!appSecret || !encryption) {
    return {
      readiness: 'server_not_ready',
      canLaunch: false,
      message:
        'La connexion guidée est préparée côté interface, mais le serveur n’est pas prêt (secret d’application ou chiffrement manquant). Aucune connexion n’est lancée.',
      publicConfig: null,
    };
  }

  return {
    readiness: 'ready_to_launch',
    canLaunch: true,
    message:
      'Connectez le WhatsApp Business de ce restaurant via Meta. Loyala enregistre ensuite le compte de façon sécurisée.',
    publicConfig,
  };
}
