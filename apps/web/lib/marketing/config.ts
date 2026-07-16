import {
  BILLING_PLANS as DOMAIN_PLANS,
  formatFcfa,
} from '@loyala/domain-billing';

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

/** Marketing pricing — sourced from canonical @loyala/domain-billing catalogue */
export const PRICING_PLANS = DOMAIN_PLANS.map((plan) => ({
  id: plan.code,
  name: plan.name,
  price: plan.amountXaf === 0 ? '0' : formatFcfa(plan.amountXaf).replace(' FCFA', ''),
  period: plan.amountXaf === 0 ? '14 jours' : 'FCFA / mois',
  description: plan.description,
  features: [...plan.features],
  cta: plan.code === 'trial' ? 'Démarrer gratuitement' : 'Choisir ce plan',
  href: plan.code === 'trial' ? '/signup' : '/billing',
  ctaType: (plan.code === 'trial' ? 'signup' : 'demo') as 'signup' | 'demo',
  highlighted: Boolean(plan.highlighted),
}));
