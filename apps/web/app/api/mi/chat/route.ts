import { NextResponse } from 'next/server';
import { hasPermission } from '@loyala/core-iam';
import { miChatRequestSchema } from '@loyala/validation';
import { getAuthContext } from '@/lib/auth/session';
import { runMiChatTurn } from '@/lib/mi/run-turn';
import { withRateLimit } from '@/lib/security/api-guard';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/mi/chat — Marketing Intelligence Phase 1 L2.
 * Consultatif uniquement : lecture CRM + réponse IA grounded.
 * organizationId depuis la session (jamais depuis le body).
 */
export async function POST(request: Request) {
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

      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON', code: 'validation_error' },
          { status: 400 }
        );
      }

      const parsed = miChatRequestSchema.safeParse(raw);
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
      const result = await runMiChatTurn({
        supabase,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        message: parsed.data.message,
        period: parsed.data.period,
        history: parsed.data.history,
        locale: parsed.data.locale,
      });

      if (!result.ok) {
        const status =
          result.code === 'validation_error'
            ? 400
            : result.code === 'ai_quota'
              ? 429
              : result.code === 'ai_timeout'
                ? 504
                : 502;
        return NextResponse.json(
          {
            error: result.message,
            code: result.code,
            dataQuality: result.dataQuality ?? null,
          },
          { status }
        );
      }

      return NextResponse.json({
        answer: result.answer,
        intent: result.intent,
        dataQuality: result.dataQuality,
        period: result.period,
        toolsUsed: result.toolsUsed,
        insights: result.insights,
        meta: result.meta,
      });
    },
    'mi-chat'
  );
}
