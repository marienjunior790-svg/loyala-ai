/**
 * Provenance — LOYALA_AI_RESTAURANT_MARKETING_KNOWLEDGE_BOMAYE_V2
 * Source métier : interview Laurent Kalala (Bomaye), pas des vérités universelles.
 */
export const BOMAYE_KNOWLEDGE_SOURCE = {
  documentId: 'LOYALA_AI_RESTAURANT_MARKETING_KNOWLEDGE_BOMAYE_V2',
  documentTitle: 'LOYALA AI — Base de connaissances Restaurant Marketing (Bomaye V2)',
  version: '2.0',
  expert: 'Laurent Kalala',
  expertRole: 'Cofondateur de Bomaye ; ex-Directeur Marketing/Com Retail (Zara, Undiz, Jennyfer)',
  mentor: 'Céline Chung (BAO Family)',
  media: 'Hey Pongo Podcast #3 — Bomaye : Le pouvoir du marketing sur un restaurant',
  mediaUrl: 'https://youtu.be/l40A_4xTN_o',
  mediaDuration: '56m19s',
  establishment: 'Bomaye — 16 rue de Paradis, Paris 10e (fast-casual burgers inspirés des cuisines africaines)',
  scopeNote:
    'Enseignements issus de ~16 mois d’exploitation Bomaye Paris. Les seuils et exemples sont contextualisés à cette source ; ils ne garantissent pas une performance réplicable.',
  softwareExamplesNote:
    'Zelty, Yavin, Pongo, Inpulse, Eezy sont la stack citée ; substituables si mêmes principes (API ouvertes, ergonomie terrain).',
} as const;

export type BomayeSourceRef = {
  documentId: typeof BOMAYE_KNOWLEDGE_SOURCE.documentId;
  strategyId?: string;
  ruleId?: string;
  section: string;
  timestamps?: string[];
  confidence: 'directly_taught' | 'derived_from_case';
};
