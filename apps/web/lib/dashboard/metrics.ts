import type { SupabaseClient } from '@supabase/supabase-js';
import { getCrmKpis } from './crm-metrics';
import { getRecentActivity } from './activity';
import { getRevenueChart, getVisitsChart } from './charts';
import { fetchAIMetricsForTenant } from '@/lib/ai/metrics';
import {
  getReviewsSummary,
  getLoyaltySummary,
  listCampaigns,
} from '@loyala/domain-crm';
import type { DashboardMetrics, KpiMetric } from './types';

export type { KpiMetric, ChartPoint, ActivityItem, DashboardMetrics } from './types';

export async function getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const [crmKpis, revenueChart, visitsChart, recentActivity, ai, reviews, loyalty, campaigns] =
    await Promise.all([
      getCrmKpis(supabase, organizationId).catch(() => fallbackKpis()),
      getRevenueChart(supabase, organizationId).catch(() => []),
      getVisitsChart(supabase, organizationId).catch(() => []),
      getRecentActivity(supabase, organizationId).catch(() => []),
      fetchAIMetricsForTenant(supabase, organizationId).catch(() => null),
      getReviewsSummary(supabase, organizationId).catch(() => null),
      getLoyaltySummary(supabase, organizationId).catch(() => null),
      listCampaigns(supabase, organizationId).catch(() => []),
    ]);

  const extraKpis: KpiMetric[] = [];

  if (reviews && reviews.count > 0) {
    extraKpis.push({
      id: 'reviews-avg',
      label: 'Note moyenne',
      value: reviews.averageRating.toFixed(1),
      change: 0,
      changeLabel: `${reviews.count} avis`,
      trend: 'up',
    });
  }

  if (loyalty) {
    extraKpis.push({
      id: 'loyalty-points',
      label: 'Points fidélité',
      value: String(loyalty.totalPoints),
      change: 0,
      changeLabel: `${loyalty.clientsWithPoints} clients`,
      trend: 'up',
    });
  }

  extraKpis.push({
    id: 'campaigns-count',
    label: 'Campagnes',
    value: String(campaigns.length),
    change: 0,
    changeLabel: 'créées',
    trend: 'neutral',
  });

  return {
    kpis: [...crmKpis, ...extraKpis].slice(0, 6),
    revenueChart,
    visitsChart,
    recentActivity,
    ai,
  };
}

function fallbackKpis(): KpiMetric[] {
  return [
    { id: 'crm-total', label: 'Clients', value: '—', change: 0, changeLabel: '', trend: 'neutral' },
  ];
}
