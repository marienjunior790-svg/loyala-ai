import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';
import { KpiGrid } from '@/components/dashboard/kpi-card';
import type { KpiMetric } from '@/lib/dashboard/metrics';

const loyaltyKpis: KpiMetric[] = [
  {
    id: 'points-issued',
    label: 'Points émis',
    value: '12 480',
    change: 9.2,
    changeLabel: 'ce mois',
    trend: 'up',
  },
  {
    id: 'rewards-redeemed',
    label: 'Récompenses utilisées',
    value: '186',
    change: 14.1,
    changeLabel: 'ce mois',
    trend: 'up',
  },
  {
    id: 'active-members',
    label: 'Membres actifs',
    value: '642',
    change: 5.8,
    changeLabel: 'vs mois dernier',
    trend: 'up',
  },
];

export default function LoyaltyPage() {
  return (
    <SectionPlaceholder
      title="Programme fidélité"
      description="Gérez points, paliers et récompenses pour maximiser la rétention."
      badge="Sprint 2"
    >
      <KpiGrid metrics={loyaltyKpis} />
    </SectionPlaceholder>
  );
}
