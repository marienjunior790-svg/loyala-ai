/**
 * Formules KPI & seuils Bomaye V2 §G — source-bound, pas universels.
 */
export interface BomayeKpiFormula {
  id: string;
  name: string;
  expression: string;
  unit: string;
  /** Seuils indicatifs issus du document Bomaye. */
  recommendedThreshold: string;
  controlFrequency: string;
  section: 'G' | 'D';
}

export const BOMAYE_KPI_FORMULAS: readonly BomayeKpiFormula[] = [
  {
    id: 'KPI-FOOD-COST',
    name: 'Ratio Coût Matière (Food Cost %)',
    expression: '(Coût Achats Matières Consommées / CA Net HT) * 100',
    unit: '%',
    recommendedThreshold: '28 % à 32 % maximum (source Bomaye §G)',
    controlFrequency: 'Hebdomadaire',
    section: 'G',
  },
  {
    id: 'KPI-LABOR-COST',
    name: 'Masse Salariale Ratio (Labor Cost)',
    expression: '(Masse Salariale Chargée / CA Net HT) * 100',
    unit: '%',
    recommendedThreshold: '30 % à 35 % maximum (source Bomaye §G)',
    controlFrequency: 'Mensuel',
    section: 'G',
  },
  {
    id: 'KPI-DELIVERY-DEPENDENCY',
    name: 'Taux de Dépendance Livraison',
    expression: '(CA Brut Plateformes de Livraison / CA Global) * 100',
    unit: '%',
    recommendedThreshold: '≤ 10 % à 15 % (source Bomaye §G)',
    controlFrequency: 'Hebdomadaire',
    section: 'G',
  },
  {
    id: 'KPI-REPEAT-RATE',
    name: 'Taux de Rétention / Repeat Rate',
    expression: '(Clients ayant commandé ≥ 2 fois / Total Clients CRM) * 100',
    unit: '%',
    recommendedThreshold: '≥ 25 % à 35 % (source Bomaye §G)',
    controlFrequency: 'Mensuel',
    section: 'G',
  },
  {
    id: 'KPI-DROP-MIX',
    name: 'Mix-Produit Drop Éphémère',
    expression: '(Ventes du Plat en Collab / Total Ventes Plats Principaux) * 100',
    unit: '%',
    recommendedThreshold: '15 % à 25 % (source Bomaye §G)',
    controlFrequency: 'Sur 30 jours',
    section: 'G',
  },
  {
    id: 'KPI-CASH-VARIANCE',
    name: 'Écart de Caisse Théorique vs Réel',
    expression: '(|Encaissement Réel - Ventes Enregistrées| / Ventes) * 100',
    unit: '%',
    recommendedThreshold: '< 0,5 % (source Bomaye §G)',
    controlFrequency: 'Quotidien',
    section: 'G',
  },
  {
    id: 'KPI-YIELD-SQM',
    name: 'Rendement Surface Commerciale',
    expression: 'CA Annuel HT / Surface Totale Exploitée (m²)',
    unit: '€ / m²',
    recommendedThreshold: '> 8 000 € / m² (source Bomaye §G — contexte EU cité)',
    controlFrequency: 'Trimestriel',
    section: 'G',
  },
] as const;

/** Calcule un KPI si numérateur/dénominateur fournis ; sinon null (pas d’invention). */
export function computeBomayeRatioPct(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  return Math.round(((numerator / denominator) * 100) * 100) / 100;
}

export function listBomayeKpiFormulas(): readonly BomayeKpiFormula[] {
  return BOMAYE_KPI_FORMULAS;
}
