import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { requireAuth } from '@/lib/auth/guard';
import { getDashboardMetrics } from '@/lib/dashboard/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalyticsPage() {
  const ctx = await requireAuth();
  const metrics = await getDashboardMetrics(ctx.organizationId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rapports détaillés sur la performance de votre restaurant.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Revenus fidélité"
          description="Tendance hebdomadaire"
          data={metrics.revenueChart}
        />
        <AnalyticsPanel
          title="Fréquence de visite"
          description="Par semaine"
          data={metrics.visitsChart}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segments clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Segmentation avancée disponible prochainement.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              En attendant, filtrez vos clients actifs et inactifs depuis la liste Clients.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
