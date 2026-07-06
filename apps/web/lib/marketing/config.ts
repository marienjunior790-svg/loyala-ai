export const DEMO_WHATSAPP =
  process.env.NEXT_PUBLIC_DEMO_WHATSAPP?.replace(/\D/g, '') ?? '221771234567';

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
    highlighted: false,
  },
] as const;
