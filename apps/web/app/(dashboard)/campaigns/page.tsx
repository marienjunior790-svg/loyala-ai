import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const upcomingFeatures = [
  'Templates WhatsApp pré-approuvés',
  'Segmentation automatique IA',
  'Planification & récurrence',
  'Tracking ouvertures / clics',
];

export default function CampaignsPage() {
  return (
    <SectionPlaceholder
      title="Campagnes WhatsApp"
      description="Envoyez des messages ciblés à vos clients pour booster les visites et la fidélité."
      badge="Sprint 2"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {upcomingFeatures.map((feature) => (
          <Card key={feature}>
            <CardContent className="flex items-center justify-between p-5">
              <span className="text-sm font-medium">{feature}</span>
              <Badge variant="outline">À venir</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionPlaceholder>
  );
}
