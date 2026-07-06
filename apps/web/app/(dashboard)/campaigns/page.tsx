import { requireAuth } from '@/lib/auth/guard';
import { getWorkerHealth } from '@/lib/worker/client';
import { WorkerIntegrationStatus } from '@/components/worker/worker-integration-status';
import { ComingSoonModule } from '@/components/dashboard/coming-soon-module';

export const dynamic = 'force-dynamic';

const upcomingFeatures = [
  'Templates WhatsApp pré-approuvés',
  'Segmentation automatique IA',
  'Planification & récurrence',
  'Suivi des relances envoyées',
];

export default async function CampaignsPage() {
  const ctx = await requireAuth();
  const workerHealth = await getWorkerHealth();

  return (
    <div className="space-y-6 animate-fade-in">
      <WorkerIntegrationStatus health={workerHealth} organizationId={ctx.organizationId} />
      <ComingSoonModule
        title="Campagnes WhatsApp"
        description="Envoyez des messages ciblés à vos clients pour booster les visites et la fidélité."
        features={upcomingFeatures}
      />
    </div>
  );
}
