function currencyLabel(currency: string) {
  return currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
}

export function formatMoney(amount: number, currency = 'XOF'): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currencyLabel(currency)}`;
}

/** Montant court pour les axes et petites cartes : 12 k, 1,5 M. */
export function formatCompactMoney(amount: number, currency = 'XOF'): string {
  const label = currencyLabel(currency);
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M ${label}`;
  }
  if (Math.abs(amount) >= 10_000) return `${Math.round(amount / 1_000).toLocaleString('fr-FR')} k ${label}`;
  return formatMoney(amount, currency);
}

/** Le fuseau est imposé pour que le serveur et le navigateur affichent le même jour. */
export function formatShortDate(iso: string | null, timeZone = 'Africa/Dakar'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  } catch {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
}
