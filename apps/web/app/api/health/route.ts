import { NextResponse } from 'next/server';
import { getWorkerHealth } from '@/lib/worker/client';
import { getWebEnvDiagnostics } from '@/lib/env-runtime';

export async function GET() {
  const started = Date.now();

  try {
    const env = getWebEnvDiagnostics();
    const checks: Record<string, 'ok' | 'error' | 'degraded' | 'skipped'> = {
      env: env.critical ? 'error' : env.featureDegraded ? 'degraded' : 'ok',
      supabase: 'skipped',
      worker: 'skipped',
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: supabaseKey },
          signal: AbortSignal.timeout(5000),
        });
        checks.supabase = res.ok ? 'ok' : 'error';
      } catch {
        checks.supabase = 'error';
      }
    } else {
      checks.supabase = 'error';
    }

    const workerHealth = await getWorkerHealth();
    if (!workerHealth.configured) {
      checks.worker = env.featureDegraded ? 'degraded' : 'skipped';
    } else {
      checks.worker = workerHealth.reachable ? 'ok' : 'error';
    }

    const webHealthy = !env.critical && checks.supabase !== 'error';
    const globallyDegraded =
      env.featureDegraded || checks.worker === 'degraded' || checks.worker === 'error';

    const httpStatus = webHealthy ? 200 : 503;

    return NextResponse.json(
      {
        status: !webHealthy ? 'unhealthy' : globallyDegraded ? 'degraded' : 'ok',
        service: 'loyala-web',
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        checks,
        configuration: {
          missingVariables: env.missingVariables,
          issues: env.issues,
          appUrl:
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null),
          workerConfigured: Boolean(process.env.WORKER_URL),
          resendConfigured: Boolean(process.env.RESEND_API_KEY),
        },
        worker: workerHealth.configured
          ? {
              reachable: workerHealth.reachable,
              service: workerHealth.service,
              inngest: workerHealth.inngest,
              latencyMs: workerHealth.latencyMs,
              error: workerHealth.error,
            }
          : null,
        latencyMs: Date.now() - started,
      },
      { status: httpStatus }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'loyala-web',
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        checks: { env: 'error', supabase: 'skipped', worker: 'skipped' },
        configuration: {
          missingVariables: [],
          issues: [
            {
              variable: 'HEALTH_HANDLER',
              severity: 'critical',
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        },
        latencyMs: Date.now() - started,
      },
      { status: 503 }
    );
  }
}
