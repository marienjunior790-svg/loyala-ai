import type { MiChatRequest } from '@loyala/validation';

export type MiPeriod = NonNullable<MiChatRequest['period']>;
export type MiLocale = NonNullable<MiChatRequest['locale']>;

export const MI_PERIODS: { value: MiPeriod; labelFr: string; labelEn: string }[] = [
  { value: 'semaine', labelFr: 'Semaine', labelEn: 'Week' },
  { value: 'mois', labelFr: 'Mois', labelEn: 'Month' },
  { value: '3mois', labelFr: '3 mois', labelEn: '3 months' },
  { value: 'annee', labelFr: 'Année', labelEn: 'Year' },
];

export const MI_SUGGESTIONS_FR = [
  'Qui sont mes meilleurs clients sur 30 jours ?',
  'Quels plats se vendent le mieux ce mois-ci ?',
  'Quels clients fidèles sont inactifs ?',
  'Quelles sont les tendances par rapport à la période précédente ?',
  'Quelles opportunités prioritaires vois-tu ?',
  'Quels clients dois-je fidéliser en priorité ?',
  'Comment encourager mes nouveaux clients à revenir ?',
  'Quels segments méritent une action cette semaine ?',
  'Propose-moi une campagne de réactivation',
  'Préparer un brouillon de campagne fidélisation',
  'Donne-moi un aperçu de la performance clients.',
] as const;

export const MI_SUGGESTIONS_EN = [
  'Who are my top clients over the last 30 days?',
  'Which dishes sell best this month?',
  'Which loyal clients are inactive?',
  'What are the trends versus the previous period?',
  'What are the priority opportunities?',
  'Which clients should I prioritize for retention?',
  'How can I encourage new clients to come back?',
  'Which segments deserve an action this week?',
  'Suggest a reactivation campaign',
  'Prepare a loyalty campaign draft',
  'Give me an overview of client performance.',
] as const;

export function periodLabel(period: MiPeriod, locale: MiLocale): string {
  const row = MI_PERIODS.find((p) => p.value === period);
  if (!row) return period;
  return locale === 'en' ? row.labelEn : row.labelFr;
}

export function suggestionsFor(locale: MiLocale): readonly string[] {
  return locale === 'en' ? MI_SUGGESTIONS_EN : MI_SUGGESTIONS_FR;
}

/** Messages utilisateur pour les codes HTTP / métier de POST /api/mi/chat. */
export function miHttpErrorMessage(
  status: number,
  code: string | null,
  serverMessage: string | null,
  locale: MiLocale
): string {
  const fr = locale !== 'en';
  if (status === 401) {
    return fr
      ? 'Session expirée. Reconnectez-vous pour continuer.'
      : 'Your session expired. Please sign in again.';
  }
  if (status === 403) {
    return fr
      ? 'Accès refusé : la permission analytics:read est requise pour Marketing Intelligence.'
      : 'Access denied: analytics:read is required for Marketing Intelligence.';
  }
  if (status === 400) {
    return (
      serverMessage ||
      (fr ? 'Requête invalide. Vérifiez votre message.' : 'Invalid request. Check your message.')
    );
  }
  if (status === 429 || code === 'ai_quota') {
    return fr
      ? 'Limite atteinte (quota ou trop de requêtes). Réessayez dans un moment.'
      : 'Limit reached (quota or rate limit). Please try again shortly.';
  }
  if (status === 504 || code === 'ai_timeout') {
    return fr
      ? 'Délai dépassé. Réessayez — les données n’ont pas été modifiées.'
      : 'Request timed out. Try again — no data was changed.';
  }
  if (status === 502 || code === 'ai_error' || code === 'data_error') {
    return (
      serverMessage ||
      (fr
        ? 'Le service est temporairement indisponible.'
        : 'The service is temporarily unavailable.')
    );
  }
  if (status === 0) {
    return fr
      ? 'Réseau indisponible. Vérifiez votre connexion.'
      : 'Network unavailable. Check your connection.';
  }
  return (
    serverMessage ||
    (fr ? `Erreur inattendue (${status}).` : `Unexpected error (${status}).`)
  );
}

export function insufficientBanner(locale: MiLocale): string {
  return locale === 'en'
    ? 'Insufficient data — no statistics were invented.'
    : 'Données insuffisantes — aucun chiffre n’a été inventé.';
}

export function localHistoryNotice(locale: MiLocale): string {
  return locale === 'en'
    ? 'Conversation is stored only in this browser tab (not saved on the server).'
    : 'La conversation reste uniquement dans cet onglet (non enregistrée sur le serveur).';
}
