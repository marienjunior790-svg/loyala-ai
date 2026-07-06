/** Normalise un numéro local (ex. 065719922) vers format wa.me international */
function normalizeWhatsAppDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Maroc : 06/07xxxxxxxx → 2126/7xxxxxxxx
  if (/^0[67]\d{8}$/.test(digits)) {
    return `212${digits.slice(1)}`;
  }
  return digits;
}

export const DEMO_WHATSAPP = normalizeWhatsAppDigits(
  process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? '065719922'
);

export const PRICING_PLANS = [
  {
    id: 'trial',
    name: 'Essai',
    price: '0',
    period: '14 jours',
    description: 'CRM complet, sans carte bancaire',
    features: ['Clients illimités', '1 restaurant', 'Support WhatsApp'],
    cta: 'Démarrer gratuitement',
    href: '/signup',
    ctaType: 'signup' as const,
    highlighted: false,
  },
  {
    id: 'growth',
    name: 'Croissance',
    price: '19 900',
    period: 'FCFA / mois',
    description: 'Le choix des restaurants actifs',
    features: [
      'CRM + relances WhatsApp',
      '500 messages / mois',
      'Segmentation clients',
      'Dashboard ROI',
    ],
    cta: 'Réserver une démo',
    href: '/signup',
    ctaType: 'demo' as const,
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '39 900',
    period: 'FCFA / mois',
    description: 'Multi-service & volume',
    features: ['Messages illimités', '2 numéros WhatsApp', 'Analytics avancés', 'Support prioritaire'],
    cta: 'Parler à un expert',
    href: '/signup',
    ctaType: 'demo' as const,
    highlighted: false,
  },
] as const;
