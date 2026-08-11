export type PlanCode = 'trial' | 'growth' | 'pro';
export type MobileProvider = 'MTN' | 'AIRTEL';

export interface BillingPlan {
  code: PlanCode;
  name: string;
  amountXaf: number;
  periodDays: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  /** Shown on marketing Tarifs + billing upgrade cards */
  publicOffer?: boolean;
}

/** Canonical Loyala catalogue (XAF / FCFA display). */
export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    code: 'trial',
    name: 'Gratuit',
    amountXaf: 0,
    periodDays: 1,
    description: '24 heures pour tester, options limitées',
    features: [
      '1 restaurant',
      'Jusqu’à 20 clients',
      'Consultation CRM de base',
      'Sans paiements / sans volume WhatsApp',
    ],
    publicOffer: true,
  },
  {
    // Legacy code kept for existing orgs / DB — not sold on Tarifs
    code: 'growth',
    name: 'Croissance',
    amountXaf: 19900,
    periodDays: 30,
    description: 'Ancienne offre (non proposée)',
    features: [
      'CRM + relances WhatsApp',
      '500 messages / mois',
      'Segmentation clients',
      'Dashboard ROI',
    ],
    publicOffer: false,
  },
  {
    code: 'pro',
    name: 'Pro',
    amountXaf: 80000,
    periodDays: 30,
    description: 'CRM + WhatsApp pour restaurants actifs',
    features: [
      'Clients illimités',
      'Relances WhatsApp',
      'Messages illimités',
      '2 numéros WhatsApp',
      'Analytics avancés',
      'Support prioritaire',
    ],
    highlighted: true,
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
