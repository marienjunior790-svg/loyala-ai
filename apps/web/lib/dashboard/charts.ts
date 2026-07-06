import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartPoint } from './types';
import { listClients, syncClientSegments, computeClientSegment } from '@loyala/domain-crm';

export async function getVisitsChart(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ChartPoint[]> {
  let clients = await listClients(supabase, organizationId);
  await syncClientSegments(supabase, organizationId, clients);
  clients = await listClients(supabase, organizationId);

  const weeks = ['S-3', 'S-2', 'S-1', 'Cette semaine'];
  const now = Date.now();
  const buckets = [0, 0, 0, 0];

  for (const c of clients) {
    const ref = c.last_visit_at ?? c.created_at;
    const days = Math.floor((now - new Date(ref).getTime()) / (86400000));
    if (days <= 7) buckets[3]++;
    else if (days <= 14) buckets[2]++;
    else if (days <= 21) buckets[1]++;
    else if (days <= 28) buckets[0]++;
  }

  return weeks.map((label, i) => ({ label, value: buckets[i] ?? 0 }));
}

export async function getRevenueChart(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ChartPoint[]> {
  const clients = await listClients(supabase, organizationId);

  const segments = ['new', 'regular', 'vip', 'inactive', 'at_risk'] as const;
  const totals: Record<string, number> = Object.fromEntries(segments.map((s) => [s, 0]));

  for (const c of clients) {
    const seg = computeClientSegment(c);
    totals[seg] = (totals[seg] ?? 0) + Number(c.total_spent ?? 0);
  }

  return segments.map((label) => ({
    label,
    value: Math.round((totals[label] ?? 0) / 1000),
  }));
}

export async function getSegmentBreakdown(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ segment: string; count: number }[]> {
  let clients = await listClients(supabase, organizationId);
  await syncClientSegments(supabase, organizationId, clients);
  clients = await listClients(supabase, organizationId);

  const counts = new Map<string, number>();
  for (const c of clients) {
    const seg = computeClientSegment(c);
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([segment, count]) => ({ segment, count }))
    .sort((a, b) => b.count - a.count);
}
