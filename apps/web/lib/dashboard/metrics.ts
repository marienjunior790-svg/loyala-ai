export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'client' | 'campaign' | 'review' | 'loyalty';
}

export interface DashboardMetrics {
  kpis: KpiMetric[];
  revenueChart: ChartPoint[];
  visitsChart: ChartPoint[];
  recentActivity: ActivityItem[];
  ai?: import('@/lib/ai/metrics').AIMetricsSummary | null;
}

const EMPTY_CHARTS: ChartPoint[] = [];
const EMPTY_ACTIVITY: ActivityItem[] = [];

/** Real tenant metrics — no fabricated charts or activity */
function getRealDashboardMetrics(kpis: KpiMetric[]): DashboardMetrics {
  return {
    kpis,
    revenueChart: EMPTY_CHARTS,
    visitsChart: EMPTY_CHARTS,
    recentActivity: EMPTY_ACTIVITY,
    ai: null,
  };
}

/** Demo CRM metrics — merges real client KPIs when organizationId provided */
export async function getDashboardMetrics(organizationId?: string): Promise<DashboardMetrics> {
  if (!organizationId) return getDemoDashboardMetrics();

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { fetchAIMetricsForTenant } = await import('@/lib/ai/metrics');
    const { getCrmKpis } = await import('./crm-metrics');
    const supabase = await createClient();
    const [crmKpis, ai] = await Promise.all([
      getCrmKpis(supabase, organizationId),
      fetchAIMetricsForTenant(supabase, organizationId).catch(() => null),
    ]);
    return { ...getRealDashboardMetrics(crmKpis), ai };
  } catch {
    const { getCrmKpis } = await import('./crm-metrics');
    const { createClient } = await import('@/lib/supabase/server');
    try {
      const supabase = await createClient();
      const crmKpis = await getCrmKpis(supabase, organizationId);
      return getRealDashboardMetrics(crmKpis);
    } catch {
      return getRealDashboardMetrics([]);
    }
  }
}

function getDemoDashboardMetrics(): DashboardMetrics {
  return {
    kpis: [
      {
        id: 'active-clients',
        label: 'Clients actifs',
        value: '1 248',
        change: 12.4,
        changeLabel: 'vs mois dernier',
        trend: 'up',
      },
      {
        id: 'at-risk',
        label: 'Clients à risque',
        value: '86',
        change: -4.2,
        changeLabel: 'vs mois dernier',
        trend: 'down',
      },
      {
        id: 'loyalty-revenue',
        label: 'Revenus fidélité',
        value: '4,2M XOF',
        change: 18.7,
        changeLabel: 'vs mois dernier',
        trend: 'up',
      },
      {
        id: 'return-rate',
        label: 'Taux retour client',
        value: '34,8 %',
        change: 2.1,
        changeLabel: 'vs mois dernier',
        trend: 'up',
      },
      {
        id: 'campaigns-sent',
        label: 'Campagnes envoyées',
        value: '24',
        change: 6,
        changeLabel: 'ce mois',
        trend: 'up',
      },
      {
        id: 'satisfaction',
        label: 'Score satisfaction',
        value: '4,6 / 5',
        change: 0.3,
        changeLabel: 'vs trimestre',
        trend: 'up',
      },
    ],
    revenueChart: [
      { label: 'Lun', value: 420 },
      { label: 'Mar', value: 380 },
      { label: 'Mer', value: 510 },
      { label: 'Jeu', value: 470 },
      { label: 'Ven', value: 620 },
      { label: 'Sam', value: 780 },
      { label: 'Dim', value: 690 },
    ],
    visitsChart: [
      { label: 'S1', value: 62 },
      { label: 'S2', value: 74 },
      { label: 'S3', value: 68 },
      { label: 'S4', value: 88 },
    ],
    recentActivity: [
      {
        id: '1',
        title: 'Nouveau client VIP',
        description: 'Aminata Diallo — segment gold',
        time: 'Il y a 12 min',
        type: 'client',
      },
      {
        id: '2',
        title: 'Campagne WhatsApp envoyée',
        description: 'Offre week-end — 342 destinataires',
        time: 'Il y a 1 h',
        type: 'campaign',
      },
      {
        id: '3',
        title: 'Avis Google 5 étoiles',
        description: '« Service impeccable » — Le Petit Dakar',
        time: 'Il y a 3 h',
        type: 'review',
      },
      {
        id: '4',
        title: 'Points fidélité crédités',
        description: '18 clients récompensés',
        time: 'Il y a 5 h',
        type: 'loyalty',
      },
    ],
  };
}
