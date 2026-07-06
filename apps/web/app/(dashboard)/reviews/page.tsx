import { ComingSoonModule } from '@/components/dashboard/coming-soon-module';

const upcomingFeatures = [
  'Centralisation des avis Google',
  'Réponses rapides depuis Loyala',
  'Alertes nouveaux avis',
  'Score e-réputation en temps réel',
];

export default function ReviewsPage() {
  return (
    <ComingSoonModule
      title="Avis Google"
      description="Centralisez vos avis, répondez rapidement et améliorez votre e-réputation."
      features={upcomingFeatures}
    />
  );
}
