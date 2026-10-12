import { PUBLIC_BILLING_PLANS as DOMAIN_PLANS, formatEur } from '@loyala/domain-billing';

/** Normalise un numéro local Congo (ex. 065719922) vers format wa.me +242 */
function normalizeWhatsAppDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('242')) return digits;
  if (digits.startsWith('0')) return `242${digits.slice(1)}`;
  return digits;
}

export const DEMO_WHATSAPP = normalizeWhatsAppDigits(
  process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? '065719922'
);

/** Marketing pricing — Gratuit, Pro, Pro+ (prices in euros, charged in FCFA). */
export const PRICING_PLANS = DOMAIN_PLANS.map((plan) => {
  const free = plan.amountXaf === 0;
  return {
    id: plan.code,
    name: plan.name,
    price: formatEur(plan.amountXaf),
    period: free ? 'pour toujours' : '/ mois',
    priceNote: free ? 'Sans carte bancaire' : 'Sans engagement, résiliable à tout moment',
    description: plan.description,
    features: [...plan.features],
    cta: free ? 'Créer mon compte gratuit' : `Choisir ${plan.name}`,
    href: free ? '/signup' : `/billing/checkout?plan=${plan.code}`,
    highlighted: Boolean(plan.highlighted),
    badge: plan.badge,
  };
});
