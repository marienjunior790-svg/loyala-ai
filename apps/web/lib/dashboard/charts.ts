import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartPoint } from './types';
import { listClients, computeClientSegment } from '@loyala/domain-crm';

const WEEK_LABELS = ['S-3+', 'S-2', 'S-1', 'Cette semaine'] as const;

/** Pure: bucket visit timestamps into the last 4 weeks (counts events, not clients). */
export function bucketVisitsByWeek(visitedAts: string[], now = Date.now()): ChartPoint[] {
  const buckets = [0, 0, 0, 0];

  for (const iso of visitedAts) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    const days = Math.floor((now - t) / 86_400_000);
    if (days < 0) continue;
    if (days <= 7) buckets[3]++;
    else if (days <= 14) buckets[2]++;
    else if (days <= 21) buckets[1]++;
    else buckets[0]++; // 22+ days ago → still visible in S-3+
  }

  return WEEK_LABELS.map((label, i) => ({ label, value: buckets[i] ?? 0 }));
}

/** Pure: convert XOF to chart units (milliers), keeping small non-zero totals visible. */
export function toChartThousands(amountXof: number): number {
  if (amountXof <= 0) return 0;
  return Math.max(1, Math.round(amountXof / 1000));
}

/**
 * Visites clients — counts real rows in `client_visits` (visit + expense)
 * over the last 4 weeks. Does not depend on segment sync.
 */
export async function getVisitsChart(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ChartPoint[]> {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('client_visits')
    .select('visited_at, kind')
    .eq('organization_id', organizationId)
    .gte('visited_at', since);

  if (error) throw new Error(error.message);

  const stamps = (data ?? [])
    .filter((row) => row.kind === 'visit' || row.kind === 'expense')
    .map((row) => String(row.visited_at));

  // Fallback: if no visit rows in window but clients have last_visit_at, use those
  // so the chart still reflects CRM activity instead of a blank empty state.
  if (stamps.length === 0) {
    const clients = await listClients(supabase, organizationId);
    const fromClients = clients
      .map((c) => c.last_visit_at)
      .filter((v): v is string => Boolean(v));
    if (fromClients.length > 0) {
      return bucketVisitsByWeek(fromClients);
    }
  }

  return bucketVisitsByWeek(stamps);
}

/**
 * Revenus fidélité — total_spent by CRM segment (milliers XOF).
 */
export async function getRevenueChart(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ChartPoint[]> {
  const clients = await listClients(supabase, organizationId);

  const segments = ['new', 'regular', 'vip', 'inactive', 'at_risk'] as const;
  const labels: Record<(typeof segments)[number], string> = {
    new: 'Nouveaux',
    regular: 'Réguliers',
    vip: 'VIP',
    inactive: 'Inactifs',
    at_risk: 'À risque',
  };
  const totals: Record<string, number> = Object.fromEntries(segments.map((s) => [s, 0]));

  for (const c of clients) {
    const seg = computeClientSegment(c);
    totals[seg] = (totals[seg] ?? 0) + Number(c.total_spent ?? 0);
  }

  return segments.map((seg) => ({
    label: labels[seg],
    value: toChartThousands(totals[seg] ?? 0),
  }));
}

export async function getSegmentBreakdown(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ segment: string; count: number }[]> {
  const clients = await listClients(supabase, organizationId);

  const counts = new Map<string, number>();
  for (const c of clients) {
    const seg = computeClientSegment(c);
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([segment, count]) => ({ segment, count }))
    .sort((a, b) => b.count - a.count);
}
