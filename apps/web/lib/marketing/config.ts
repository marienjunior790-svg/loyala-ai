import {
  PUBLIC_BILLING_PLANS as DOMAIN_PLANS,
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

function periodLabel(amountXaf: number, periodDays: number): string {
  if (amountXaf === 0) {
    return periodDays <= 1 ? '24 heures' : `${periodDays} jours`;
  }
  return 'FCFA / mois';
}

/** Marketing pricing — public offers only (Gratuit 24h + Pro). */
export const PRICING_PLANS = DOMAIN_PLANS.map((plan) => ({
  id: plan.code,
  name: plan.name,
  price: plan.amountXaf === 0 ? '0' : formatFcfa(plan.amountXaf).replace(' FCFA', ''),
  period: periodLabel(plan.amountXaf, plan.periodDays),
  description: plan.description,
  features: [...plan.features],
  cta: plan.code === 'trial' ? 'Démarrer gratuitement' : 'Choisir Pro',
  href: plan.code === 'trial' ? '/signup' : '/billing/checkout?plan=pro',
  ctaType: (plan.code === 'trial' ? 'signup' : 'signup') as 'signup' | 'demo',
  highlighted: Boolean(plan.highlighted),
}));
