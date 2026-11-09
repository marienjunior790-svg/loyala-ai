/**
 * Machine d'état UX Embedded Signup — pure, testable.
 * Le restaurant ne voit jamais d'identifiants techniques.
 */

export type EmbeddedSignupFlowPhase =
  | 'unconfigured'
  | 'ready'
  | 'launching_meta'
  | 'meta_authenticating'
  | 'server_processing'
  | 'verifying'
  | 'connected'
  | 'cancelled'
  | 'failed'
  | 'already_connected';

export type EmbeddedSignupFlowCopy = {
  title: string;
  detail: string;
  /** true = état terminal négatif ou succès — UI idle pour retry / lecture */
  terminal: boolean;
  tone: 'neutral' | 'progress' | 'success' | 'danger';
};

export function resolveInitialEmbeddedSignupPhase(input: {
  canLaunch: boolean;
  connectionReady: boolean;
}): EmbeddedSignupFlowPhase {
  if (input.connectionReady) return 'already_connected';
  if (!input.canLaunch) return 'unconfigured';
  return 'ready';
}

export function embeddedSignupFlowCopy(phase: EmbeddedSignupFlowPhase): EmbeddedSignupFlowCopy {
  switch (phase) {
    case 'unconfigured':
      return {
        title: 'Connexion guidée indisponible',
        detail:
          'L’infrastructure Meta n’est pas encore prête. Un administrateur Loyala doit finaliser la configuration globale.',
        terminal: true,
        tone: 'neutral',
      };
    case 'ready':
      return {
        title: 'Prêt',
        detail: 'Connectez le WhatsApp Business de ce restaurant en un clic. Meta vous demandera d’autoriser le compte.',
        terminal: false,
        tone: 'neutral',
      };
    case 'launching_meta':
      return {
        title: 'Ouverture de WhatsApp Business…',
        detail: 'Préparation de la connexion sécurisée avec Meta.',
        terminal: false,
        tone: 'progress',
      };
    case 'meta_authenticating':
      return {
        title: 'Autorisation Meta…',
        detail: 'Choisissez le compte WhatsApp Business de ce restaurant et validez les permissions.',
        terminal: false,
        tone: 'progress',
      };
    case 'server_processing':
      return {
        title: 'Configuration sécurisée de votre connexion…',
        detail: 'Loyala finalise automatiquement l’autorisation. Ne fermez pas cette page.',
        terminal: false,
        tone: 'progress',
      };
    case 'verifying':
      return {
        title: 'Vérification de votre numéro WhatsApp…',
        detail: 'Contrôle que le compte est bien associé à ce restaurant.',
        terminal: false,
        tone: 'progress',
      };
    case 'connected':
      return {
        title: 'WhatsApp est connecté ✓',
        detail: 'Votre WhatsApp Business est prêt pour ce restaurant.',
        terminal: true,
        tone: 'success',
      };
    case 'cancelled':
      return {
        title: 'Configuration annulée',
        detail: 'Vous pouvez réessayer quand vous voulez.',
        terminal: true,
        tone: 'neutral',
      };
    case 'already_connected':
      return {
        title: 'WhatsApp déjà connecté',
        detail: 'Ce restaurant a déjà une connexion opérationnelle. Aucun nouvel identifiant n’est demandé.',
        terminal: true,
        tone: 'success',
      };
    case 'failed':
    default:
      return {
        title: 'La connexion n’a pas pu être finalisée',
        detail: 'Réessayez. Si le problème continue, un responsable peut utiliser la configuration avancée.',
        terminal: true,
        tone: 'danger',
      };
  }
}

export function mapLaunchFailureToPhase(
  reason: 'cancelled' | 'sdk_error' | 'missing_code' | 'missing_assets' | string
): EmbeddedSignupFlowPhase {
  if (reason === 'cancelled') return 'cancelled';
  return 'failed';
}

/** Empêche un faux succès UI avant validation serveur. */
export function canClaimConnected(input: {
  serverConnected: boolean;
  healthOk: boolean;
}): boolean {
  return input.serverConnected && input.healthOk;
}

/** Décide le payload public post-complete (sans secrets). */
export function finalizeEmbeddedSignupClientResult(input: {
  isReady: boolean;
  healthOk: boolean;
  healthMessage: string;
}): { connected: boolean; success?: string; error?: string } {
  if (canClaimConnected({ serverConnected: input.isReady, healthOk: input.healthOk })) {
    return { connected: true, success: 'WhatsApp est connecté ✓' };
  }
  return {
    connected: false,
    error: input.healthOk
      ? 'La connexion a été enregistrée mais n’est pas encore opérationnelle. Réessayez la vérification.'
      : `La connexion n’a pas pu être confirmée. ${input.healthMessage}`,
  };
}
