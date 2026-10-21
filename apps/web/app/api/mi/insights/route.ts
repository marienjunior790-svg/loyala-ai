import { NextResponse } from 'next/server';
import { hasPermission } from '@loyala/core-iam';
import { loadMiOrgInsights, miInsightsForPrompt } from '@loyala/domain-crm';
import { miInsightsQuerySchema } from '@loyala/validation';
import { getAuthContext } from '@/lib/auth/session';
import { miInsightsSignalsIncluded } from '@/lib/mi/insights-signals';
import { withRateLimit } from '@/lib/security/api-guard';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/mi/insights — cockpit Marketing Intelligence P1.
 * Lecture CRM uniquement (même snapshot que le chat). orgId = session.
 */
export async function GET(request: Request) {
  return withRateLimit(
    request,
    async () => {
      const ctx = await getAuthContext();
      if (!ctx?.userId || !ctx.organizationId) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'unauthorized' },
          { status: 401 }
        );
      }

      if (!hasPermission(ctx, 'analytics:read')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            code: 'forbidden',
            permission: 'analytics:read',
          },
          { status: 403 }
        );
      }

      const url = new URL(request.url);
      const parsed = miInsightsQuerySchema.safeParse({
        period: url.searchParams.get('period') ?? undefined,
      });
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'validation_error',
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }

      const supabase = await createClient();
      try {
        const insights = await loadMiOrgInsights(supabase, ctx.organizationId, {
          period: parsed.data.period,
        });

        if (insights.organizationId !== ctx.organizationId) {
          return NextResponse.json(
            { error: 'Isolation organisation violée', code: 'data_error' },
            { status: 502 }
          );
        }

        return NextResponse.json({
          dataQuality: insights.dataQuality,
          period: insights.period,
          insights: miInsightsForPrompt(insights),
          toolsUsed: ['loadMiOrgInsights'],
          signalsIncluded: miInsightsSignalsIncluded(insights),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur de lecture des données';
        return NextResponse.json(
          { error: message, code: 'data_error', dataQuality: 'insufficient' },
          { status: 502 }
        );
      }
    },
    'mi-insights'
  );
}
