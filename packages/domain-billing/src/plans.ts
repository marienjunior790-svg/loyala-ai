export type PlanCode = 'trial' | 'growth' | 'pro';
export type MobileProvider = 'MTN' | 'AIRTEL';

export interface BillingPlan {
  code: PlanCode;
  name: string;
  amountXaf: number;
  periodDays: number;
  description: string;
  features: string[];
  /** Listed with a cross on pricing cards (not included in this plan). */
  excludedFeatures?: string[];
  highlighted?: boolean;
  /** Short ribbon shown above the card (e.g. "Le plus choisi"). */
  badge?: string;
  /** Shown on marketing Tarifs + billing upgrade cards */
  publicOffer?: boolean;
}

/**
 * Canonical Loyala catalogue. Amounts are charged in XAF (Mobile Money) and displayed in euros.
 * DB codes stay trial|growth|pro (CHECK constraint, existing subscriptions): growth is sold as
 * "Pro" and pro as "Pro+".
 */
export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    code: 'trial',
    name: 'Gratuit',
    amountXaf: 0,
    periodDays: 0,
    description: 'Pour démarrer tout de suite, sans limite de durée',
    features: [
      'CRM clients et relances WhatsApp',
      'Campagnes, fidélité et avis Google',
      'Tableau de bord',
      'Sans engagement, gratuit pour toujours',
    ],
    excludedFeatures: ['Analyse IA'],
    publicOffer: true,
  },
  {
    code: 'growth',
    name: 'Pro',
    amountXaf: 30000,
    periodDays: 30,
    description: 'Pour les restaurants qui relancent chaque semaine',
    features: [
      'Tout le plan Gratuit',
      'Analyse IA',
      'Clients illimités',
      'Messages WhatsApp illimités',
      '1 numéro WhatsApp Business',
      'Support par WhatsApp',
    ],
    highlighted: true,
    badge: 'Le plus choisi',
    publicOffer: true,
  },
  {
    code: 'pro',
    name: 'Pro+',
    amountXaf: 80000,
    periodDays: 30,
    description: 'Pour les restaurants à fort volume',
    features: [
      'Tout le plan Pro',
      '2 numéros WhatsApp Business',
      'Analytics avancés',
      'Support prioritaire',
      'Accompagnement à la mise en place',
    ],
    badge: 'Premium',
    publicOffer: true,
  },
] as const;

/** Plans displayed publicly (Tarifs + billing chooser). */
export const PUBLIC_BILLING_PLANS = BILLING_PLANS.filter((p) => p.publicOffer);

const PLAN_BY_CODE = new Map(BILLING_PLANS.map((p) => [p.code, p]));

export function getPlan(code: string): BillingPlan | undefined {
  return PLAN_BY_CODE.get(code as PlanCode);
}

export function isPaidPlan(code: PlanCode): boolean {
  return code === 'growth' || code === 'pro';
}

/** Map legacy DB values to canonical codes */
export function normalizePlanCode(raw: string | null | undefined): PlanCode {
  const v = (raw ?? 'trial').toLowerCase();
  if (v === 'starter') return 'growth';
  if (v === 'enterprise') return 'pro';
  if (v === 'growth' || v === 'pro' || v === 'trial') return v;
  return 'trial';
}

export function formatFcfa(amountXaf: number): string {
  return `${amountXaf.toLocaleString('fr-FR')} FCFA`;
}

/** Fixed CFA franc ↔ euro parity (XAF and XOF). */
export const XAF_PER_EUR = 655.957;

export function xafToEur(amountXaf: number): number {
  return Math.round((amountXaf / XAF_PER_EUR) * 100) / 100;
}

/** Card payments are charged in euro cents. */
export function xafToEurCents(amountXaf: number): number {
  return Math.round(xafToEur(amountXaf) * 100);
}

function formatEurValue(eur: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(eur) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(eur);
}

export function formatEur(amountXaf: number): string {
  return formatEurValue(xafToEur(amountXaf));
}

/**
 * `payments.amount` / `invoices.amount` are stored in the charge currency's smallest unit:
 * FCFA for Mobile Money (XAF), cents for card payments (EUR).
 */
export function formatPaymentAmount(amount: number, currency: string | null | undefined): string {
  if ((currency ?? 'XAF').toUpperCase() === 'EUR') {
    return formatEurValue(amount / 100);
  }
  return `${formatEur(amount)} (${formatFcfa(amount)})`;
}
