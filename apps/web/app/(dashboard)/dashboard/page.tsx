import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guard';
import { getDashboardMetrics } from '@/lib/dashboard/metrics';
import { KpiGrid } from '@/components/dashboard/kpi-card';
import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { DashboardOverviewSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

async function OverviewContent() {
  const ctx = await requireAuth();
  const metrics = await getDashboardMetrics(ctx.organizationId);

  return (
    <div className="space-y-8">
      <section className="animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Bonjour 👋</h2>
              <Badge variant="success">Live</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Vue d&apos;ensemble de votre relation client et de vos relances WhatsApp.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/clients/ajouter">
                Ajouter un client
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/clients">Voir les clients</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <KpiGrid metrics={metrics.kpis} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Revenus fidélité"
          description="7 derniers jours — en milliers XOF"
          data={metrics.revenueChart}
        />
        <AnalyticsPanel
          title="Visites clients"
          description="Par semaine — mois en cours"
          data={metrics.visitsChart}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity items={metrics.recentActivity} />
        </div>
        <Card className="animate-fade-in border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Insight IA</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {metrics.kpis.find((k) => k.id === 'crm-inactive')?.value ?? '0'} clients à relancer.
              Une campagne WhatsApp ciblée peut remplir vos tables cette semaine.
            </p>
            <Button className="mt-6 w-full" asChild>
              <Link href="/clients/ajouter">Ajouter un client</Link>
            </Button>
            <Button className="mt-2 w-full" variant="secondary" asChild>
              <Link href="/clients">Relancer mes clients</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardOverviewSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
