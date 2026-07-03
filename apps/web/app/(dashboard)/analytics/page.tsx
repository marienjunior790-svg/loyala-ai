import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { getAuthContext } from '@/lib/auth/session';
import { getDashboardMetrics } from '@/lib/dashboard/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalyticsPage() {
  const ctx = await getAuthContext();
  const metrics = await getDashboardMetrics(ctx?.organizationId);

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
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'VIP', value: '12 %', color: 'text-violet-400' },
            { label: 'Réguliers', value: '48 %', color: 'text-emerald-400' },
            { label: 'À risque', value: '7 %', color: 'text-amber-400' },
          ].map((segment) => (
            <div
              key={segment.label}
              className="rounded-lg border border-border bg-card/50 p-4 text-center"
            >
              <p className={`text-2xl font-semibold ${segment.color}`}>{segment.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{segment.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
