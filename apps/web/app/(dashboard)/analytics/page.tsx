import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/guard';
import { getDashboardMetrics } from '@/lib/dashboard/metrics';
import { getSegmentBreakdown } from '@/lib/dashboard/charts';
import { createClient } from '@/lib/supabase/server';
import { KpiGrid } from '@/components/dashboard/kpi-card';
import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { DashboardOverviewSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

import { ModuleError } from '@/components/dashboard/module-error';

async function AnalyticsContent() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let segmentError: string | null = null;
  let segments: Awaited<ReturnType<typeof getSegmentBreakdown>> = [];

  const metrics = await getDashboardMetrics(ctx.organizationId);

  try {
    segments = await getSegmentBreakdown(supabase, ctx.organizationId);
  } catch (e) {
    segmentError = e instanceof Error ? e.message : 'Segments indisponibles';
  }

  return (
    <div className="space-y-8">
      {segmentError && <ModuleError message={segmentError} />}
      <KpiGrid metrics={metrics.kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Revenus par segment"
          description="Total historique CRM (milliers XOF)"
          data={metrics.revenueChart}
        />
        <AnalyticsPanel
          title="Activité clients"
          description="Clients actifs par période (4 semaines)"
          data={metrics.visitsChart}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {segments.map((s) => (
              <Link
                key={s.segment}
                href="/segments"
                className="rounded-lg border border-border p-3 text-center hover:border-primary/30"
              >
                <p className="text-2xl font-semibold">{s.count}</p>
                <p className="text-xs capitalize text-muted-foreground">{s.segment}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {metrics.ai && metrics.ai.requests > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Métriques IA (30 jours)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Requêtes</p>
              <p className="text-xl font-semibold">{metrics.ai.requests}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tokens</p>
              <p className="text-xl font-semibold">{metrics.ai.totalTokens}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Coût estimé</p>
              <p className="text-xl font-semibold">${metrics.ai.costUsd.toFixed(4)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<DashboardOverviewSkeleton />}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">Données réelles de votre CRM</p>
        </div>
        <AnalyticsContent />
      </div>
    </Suspense>
  );
}
