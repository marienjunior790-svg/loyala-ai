import { ComingSoonModule } from '@/components/dashboard/coming-soon-module';

const upcomingFeatures = [
  'Templates WhatsApp pré-approuvés',
  'Segmentation automatique IA',
  'Planification & récurrence',
  'Suivi des relances envoyées',
];

export default function CampaignsPage() {
  return (
    <ComingSoonModule
      title="Campagnes WhatsApp"
      description="Envoyez des messages ciblés à vos clients pour booster les visites et la fidélité."
      features={upcomingFeatures}
    />
  );
}
