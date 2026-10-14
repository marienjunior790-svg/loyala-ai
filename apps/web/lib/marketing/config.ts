import { PUBLIC_BILLING_PLANS as DOMAIN_PLANS, formatEur } from '@loyala/domain-billing';
import { phoneDigitsForWhatsApp } from '@loyala/integrations/phone';

/** Numéro de démonstration FM Agence (Congo) au format wa.me : 242 06… */
export const DEMO_WHATSAPP = phoneDigitsForWhatsApp(
  process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? '065719922',
  'CG'
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
    excludedFeatures: [...(plan.excludedFeatures ?? [])],
    cta: free ? 'Créer mon compte gratuit' : `Choisir ${plan.name}`,
    href: free ? '/signup' : `/billing/checkout?plan=${plan.code}`,
    highlighted: Boolean(plan.highlighted),
    badge: plan.badge,
  };
});
