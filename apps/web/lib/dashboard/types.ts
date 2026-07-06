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
