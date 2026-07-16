/**
 * Compact per-client CRM purchase insights passed into relance/campaign prompts.
 * All fields optional so callers without a purchase history stay valid.
 */
export interface ClientInsightSummary {
  favoriteProduct?: string | null;
  favoriteCategory?: string | null;
  averageBasket?: number;
  totalSpent?: number;
  bestMonth?: string | null;
  isVip?: boolean;
}

/** Human-readable French one-liner used inside prompts. Empty when no data. */
export function formatClientInsights(summary?: ClientInsightSummary | null): string {
  if (!summary) return '';
  const parts: string[] = [];
  if (summary.favoriteProduct) parts.push(`Produit préféré: ${summary.favoriteProduct}`);
  if (summary.favoriteCategory) parts.push(`Catégorie préférée: ${summary.favoriteCategory}`);
  if (summary.averageBasket && summary.averageBasket > 0) {
    parts.push(`Panier moyen: ${Math.round(summary.averageBasket)} FCFA`);
  }
  if (summary.totalSpent && summary.totalSpent > 0) {
    parts.push(`Total dépensé: ${Math.round(summary.totalSpent)} FCFA`);
  }
  if (summary.bestMonth) parts.push(`Meilleur mois: ${summary.bestMonth}`);
  if (summary.isVip) parts.push('Client VIP');
  return parts.join('. ');
}
