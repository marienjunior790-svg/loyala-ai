import type { Metadata } from 'next';
import { LandingPage } from '@/components/marketing/landing-page';
import { SkipLink } from '@/components/ui/skip-link';
import { getPublicAppUrl } from '@/lib/app-url';

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
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'XOF',
    description: 'Essai gratuit 14 jours',
  },
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
