/**
 * Chargeur isolé du Facebook JS SDK (client uniquement).
 * Idempotent, timeout, sans SSR.
 */

export type FacebookSdkLoginOptions = {
  config_id: string;
  response_type: 'code';
  override_default_response_type: true;
  extras?: { setup?: Record<string, unknown> };
};

export type FacebookAuthResponse = {
  code?: string;
  accessToken?: string;
  expiresIn?: number;
  signedRequest?: string;
  userID?: string;
};

export type FacebookLoginResponse = {
  status: 'connected' | 'not_authorized' | 'unknown' | string;
  authResponse?: FacebookAuthResponse | null;
};

export type FacebookSdk = {
  init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: FacebookSdkLoginOptions
  ) => void;
};

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: FacebookSdk;
  }
}

const SDK_SRC = 'https://connect.facebook.net/fr_FR/sdk.js';
const DEFAULT_TIMEOUT_MS = 15_000;

let loadPromise: Promise<FacebookSdk> | null = null;

function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Le SDK Meta ne peut être chargé que dans le navigateur.');
  }
}

/**
 * Charge le SDK une seule fois. `version` ex. v21.0 (sans préfixe facebook côté init : Meta attend vX.Y).
 */
export function loadMetaSdk(input: {
  appId: string;
  apiVersion: string;
  timeoutMs?: number;
}): Promise<FacebookSdk> {
  assertBrowser();
  const appId = input.appId.trim();
  if (!appId) return Promise.reject(new Error('App ID Meta manquant'));
  const version = input.apiVersion.replace(/^v?/, 'v');
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (window.FB) {
    return Promise.resolve(window.FB);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<FacebookSdk>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      loadPromise = null;
      reject(new Error('Le SDK Meta n’a pas répondu à temps.'));
    }, timeoutMs);

    const finish = (sdk: FacebookSdk) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(sdk);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      loadPromise = null;
      reject(error);
    };

    window.fbAsyncInit = () => {
      try {
        if (!window.FB) {
          fail(new Error('SDK Meta indisponible après chargement'));
          return;
        }
        window.FB.init({
          appId,
          cookie: false,
          xfbml: false,
          version,
        });
        finish(window.FB);
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Échec d’initialisation du SDK Meta'));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      if (window.FB) {
        window.fbAsyncInit?.();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => fail(new Error('Impossible de charger le SDK Meta (réseau).'));
    document.body.appendChild(script);
  });

  return loadPromise;
}

/** Remet le cache de chargement — utile pour les tests. */
export function resetMetaSdkLoaderForTests(): void {
  loadPromise = null;
  if (typeof window !== 'undefined') {
    delete window.fbAsyncInit;
  }
}
