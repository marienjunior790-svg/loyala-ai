/**
 * Adaptations Europe vs Afrique — Bomaye V2 §I
 */
export type BomayeMarketContext = 'europe' | 'africa' | 'unknown';

export interface BomayeAdaptationRow {
  dimension: string;
  europe: string;
  africa: string;
}

export const BOMAYE_MARKET_ADAPTATIONS: readonly BomayeAdaptationRow[] = [
  {
    dimension: 'Canal CRM & Commande',
    europe: 'SMS marketing et borne de fidélité tactile au comptoir (type Pongo).',
    africa:
      'WhatsApp Business centralisé. Commandes et fidélité par messages WhatsApp conversationnels.',
  },
  {
    dimension: 'Moyens de Paiement',
    europe: 'TPE sans contact, cartes bancaires et tickets restaurant dématérialisés.',
    africa:
      'Espèces (Cash) et Mobile Money (Orange Money, Wave, MTN MoMo). Enregistrement strict des encaissements sans TPE connecté.',
  },
  {
    dimension: 'Logistique de Livraison',
    europe: 'Dépendance aux agrégateurs dominants (Uber Eats, Deliveroo).',
    africa:
      'Flotte propre moto / coursiers de proximité. Commandes WhatsApp sans commission ~30 %.',
  },
  {
    dimension: 'Collaborations Éphémères',
    europe: 'Partenariats marques de mode ou enseignes urbaines.',
    africa:
      'Producteurs locaux d’épices, bouchers de marché, créateurs de contenu lifestyle locaux.',
  },
] as const;

export function getBomayeAdaptationsForContext(ctx: BomayeMarketContext): {
  context: BomayeMarketContext;
  guidance: string[];
  rows: readonly BomayeAdaptationRow[];
} {
  if (ctx === 'africa') {
    return {
      context: 'africa',
      guidance: [
        'Prioriser WhatsApp Business comme canal CRM / commande / fidélité.',
        'Ne pas supposer Uber Eats / Deliveroo / TPE / tickets resto comme canaux disponibles.',
        'Intégrer Mobile Money + cash dans le pilotage des encaissements.',
        'Livraison : flotte propre / proximité plutôt que dépendance agrégateurs à forte commission.',
        'Collabs : producteurs / marché / créateurs locaux.',
      ],
      rows: BOMAYE_MARKET_ADAPTATIONS,
    };
  }
  if (ctx === 'europe') {
    return {
      context: 'europe',
      guidance: [
        'CRM : SMS / borne fidélité possibles ; WhatsApp reste utile.',
        'Surveiller dépendance agrégateurs (plafond ~10–15 % CA — seuil Bomaye).',
        'Paiements carte / TPE — viser unification caisse-TPE API.',
      ],
      rows: BOMAYE_MARKET_ADAPTATIONS,
    };
  }
  return {
    context: 'unknown',
    guidance: [
      'Contexte marché non précisé — demander Europe vs Afrique (ou hybride) avant de recommander canaux.',
      'Ne pas présupposer la disponibilité d’Uber Eats, TPE ou SMS marketing.',
    ],
    rows: BOMAYE_MARKET_ADAPTATIONS,
  };
}
