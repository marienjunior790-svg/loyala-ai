import type { Metadata } from 'next';
import { LandingPage } from '@/components/marketing/landing-page';
import { SkipLink } from '@/components/ui/skip-link';
import { getPublicAppUrl } from '@/lib/app-url';
import { PUBLIC_BILLING_PLANS, xafToEur } from '@loyala/domain-billing';

export const metadata: Metadata = {
  title: 'Accueil',
  description:
    'CRM IA WhatsApp pour restaurants africains. Relancez vos clients inactifs, gérez la fidélité et boostez vos revenus.',
  openGraph: {
    title: 'Loyala AI — CRM WhatsApp pour restaurants',
    description: 'Transformez vos clients en revenus récurrents via WhatsApp.',
  },
};

const appUrl = getPublicAppUrl();

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Loyala AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: appUrl,
  description: 'CRM IA WhatsApp pour restaurants africains',
  offers: PUBLIC_BILLING_PLANS.map((plan) => ({
    '@type': 'Offer',
    name: plan.name,
    price: xafToEur(plan.amountXaf).toFixed(2),
    priceCurrency: 'EUR',
    description: plan.description,
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SkipLink />
      <div id="main-content">
        <LandingPage />
      </div>
    </>
  );
}
