import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fetchAIMetricsForTenant, formatAIMetricsKpis } from '@/lib/ai/metrics';
import { withRateLimit } from '@/lib/security/api-guard';

export async function GET(request: Request) {
  return withRateLimit(request, async () => {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sinceDays = Number(searchParams.get('sinceDays') ?? 30);

    const supabase = await createClient();
    const metrics = await fetchAIMetricsForTenant(supabase, ctx.organizationId, sinceDays);

    return NextResponse.json({
      metrics,
      summary: formatAIMetricsKpis(metrics),
    });
  }, 'metrics-ai');
}
