export type PaymentMethodId = 'mobile_money' | 'card' | 'paypal' | 'bank_transfer';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  detail: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { id: 'mobile_money', label: 'Mobile Money', detail: 'MTN · Airtel' },
  { id: 'card', label: 'Carte bancaire', detail: 'Visa · Mastercard · Apple Pay · Google Pay' },
  { id: 'paypal', label: 'PayPal', detail: 'Compte PayPal ou carte' },
  { id: 'bank_transfer', label: 'Virement bancaire', detail: 'Activation sous 24 h ouvrées' },
];

/** Labels shown on the public pricing strip. */
export const PAYMENT_BRANDS = [
  'Mobile Money',
  'Visa',
  'Mastercard',
  'Apple Pay',
  'Google Pay',
  'PayPal',
  'Virement bancaire',
] as const;

/** Card/PayPal stay "Bientôt" until a processor is configured. */
export function isPaymentMethodLive(id: PaymentMethodId): boolean {
  if (id === 'mobile_money' || id === 'bank_transfer') return true;
  if (id === 'card') return process.env.CARD_PAYMENTS_ENABLED === 'true';
  return process.env.PAYPAL_ENABLED === 'true';
}

export function bankTransferReference(organizationId: string, planName: string): string {
  const org = organizationId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const plan = planName.replace(/\+/g, 'PLUS').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `LOYALA-${plan}-${org}`;
}
