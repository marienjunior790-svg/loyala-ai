import { ComingSoonModule } from '@/components/dashboard/coming-soon-module';

const upcomingFeatures = [
  'Programme points & récompenses',
  'Paliers VIP automatiques',
  'Notifications WhatsApp fidélité',
  'Tableau de bord rétention',
];

export default function LoyaltyPage() {
  return (
    <ComingSoonModule
      title="Programme fidélité"
      description="Gérez points, paliers et récompenses pour maximiser la rétention de vos clients."
      features={upcomingFeatures}
    />
  );
}
