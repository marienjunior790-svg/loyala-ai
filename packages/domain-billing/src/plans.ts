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
}

/** Canonical Loyala catalogue (XAF / FCFA display). */
export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    code: 'trial',
    name: 'Essai',
    amountXaf: 0,
    periodDays: 14,
    description: 'CRM complet, sans paiement',
    features: ['Clients illimités', '1 restaurant', 'Support WhatsApp'],
  },
  {
    code: 'growth',
    name: 'Croissance',
    amountXaf: 19900,
    periodDays: 30,
    description: 'Le choix des restaurants actifs',
    features: [
      'CRM + relances WhatsApp',
      '500 messages / mois',
      'Segmentation clients',
      'Dashboard ROI',
    ],
    highlighted: true,
  },
  {
    code: 'pro',
    name: 'Pro',
    amountXaf: 39900,
    periodDays: 30,
    description: 'Multi-service & volume',
    features: ['Messages illimités', '2 numéros WhatsApp', 'Analytics avancés', 'Support prioritaire'],
  },
] as const;

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
