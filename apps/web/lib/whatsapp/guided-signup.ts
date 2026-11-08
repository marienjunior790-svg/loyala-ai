import type { WhatsAppConnectionPublic } from '@loyala/domain-crm';

export type GuidedWhatsAppSignup = {
  /** Toujours faux tant qu’un échange de code Meta n’est pas implémenté et testé. */
  canLaunch: false;
  message: string;
};

type SignupEnv = {
  NEXT_PUBLIC_META_APP_ID?: string;
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
  WHATSAPP_APP_SECRET?: string;
  META_APP_SECRET?: string;
};

/** Indique si le parcours guidé peut être proposé. Ne renvoie jamais de secret. */
export function describeGuidedWhatsAppSignup(env: SignupEnv): GuidedWhatsAppSignup {
  const appIdPresent = Boolean(env.NEXT_PUBLIC_META_APP_ID?.trim());
  const configIdPresent = Boolean(env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim());
  const appSecretPresent = Boolean(env.WHATSAPP_APP_SECRET?.trim() || env.META_APP_SECRET?.trim());
  const configured = appIdPresent && configIdPresent && appSecretPresent;

  if (!configured) {
    return {
      canLaunch: false,
      message:
        'La connexion guidée n’est pas encore disponible. Loyala n’ouvre pas le parcours Meta tant que l’application n’est pas configurée. Aucune connexion n’est simulée.',
    };
  }

  return {
    canLaunch: false,
    message:
      'La configuration Meta est détectée, mais le parcours guidé n’est pas encore activé dans cette version. Aucune connexion n’est lancée.',
  };
}

export function readGuidedWhatsAppSignup(env?: SignupEnv): GuidedWhatsAppSignup {
  return describeGuidedWhatsAppSignup(
    env ?? {
      NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID,
      WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
      META_APP_SECRET: process.env.META_APP_SECRET,
    }
  );
}

export type WhatsAppUiState =
  | 'not_connected'
  | 'connecting'
  | 'operational'
  | 'expired'
  | 'action_required'
  | 'number_pending';

export function whatsAppUiState(
  connection: Pick<WhatsAppConnectionPublic, 'status' | 'isReady' | 'hasToken' | 'phoneNumberId' | 'displayPhone'>
): WhatsAppUiState {
  if (connection.isReady) return 'operational';
  if (connection.status === 'token_expired') return 'expired';
  if (connection.status === 'error') return 'action_required';
  if (connection.status === 'connecting') return 'connecting';
  if (
    connection.phoneNumberId?.startsWith('pending:') ||
    Boolean(connection.displayPhone && !connection.hasToken)
  ) {
    return 'number_pending';
  }
  return 'not_connected';
}

export function whatsAppStatusCopy(
  connection: Pick<WhatsAppConnectionPublic, 'status' | 'isReady' | 'hasToken' | 'phoneNumberId' | 'displayPhone'>
): { title: string; message: string } {
  switch (whatsAppUiState(connection)) {
    case 'operational':
      return {
        title: 'Connexion opérationnelle',
        message: 'Votre WhatsApp Business est prêt pour ce restaurant.',
      };
    case 'expired':
      return {
        title: 'Autorisation expirée',
        message: 'L’autorisation Meta n’est plus valable. Reconnectez le compte de ce restaurant.',
      };
    case 'action_required':
      return {
        title: 'Action requise',
        message:
          'La connexion n’a pas pu être confirmée. Vos clients restent disponibles. Un responsable peut réessayer.',
      };
    case 'connecting':
      return {
        title: 'Connexion en cours',
        message: 'Loyala attend la confirmation. Le compte n’est pas encore opérationnel.',
      };
    case 'number_pending':
      return {
        title: 'Numéro à vérifier',
        message: 'Un numéro est enregistré, mais le compte WhatsApp Business n’est pas encore confirmé.',
      };
    default:
      return {
        title: 'WhatsApp non connecté',
        message: 'Votre WhatsApp Business n’est pas encore connecté. Vous pouvez déjà gérer vos clients.',
      };
  }
}

/** Un numéro enregistré ne suffit pas à déclarer WhatsApp connecté. */
export function whatsAppDialogClaim(input: { apiReady: boolean; savedPhone: string }): {
  connected: boolean;
  title: string;
  detail: string;
} {
  if (input.apiReady) {
    return {
      connected: true,
      title: 'WhatsApp Business opérationnel',
      detail: 'La connexion de ce restaurant a été confirmée.',
    };
  }
  if (input.savedPhone.trim()) {
    return {
      connected: false,
      title: 'Numéro enregistré, connexion non établie',
      detail: 'Ce numéro ne prouve pas qu’un compte WhatsApp Business est connecté.',
    };
  }
  return {
    connected: false,
    title: 'WhatsApp non connecté',
    detail: 'Vous pouvez créer vos clients maintenant et connecter WhatsApp plus tard, dans les paramètres.',
  };
}
