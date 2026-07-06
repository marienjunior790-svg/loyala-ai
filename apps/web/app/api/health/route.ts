import { NextResponse } from 'next/server';
import { getWorkerHealth } from '@/lib/worker/client';

export async function GET() {
  const started = Date.now();
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {
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
  }

  const workerHealth = await getWorkerHealth();
  if (!workerHealth.configured) {
    checks.worker = 'skipped';
  } else {
    checks.worker = workerHealth.reachable ? 'ok' : 'error';
  }

  const healthy = Object.values(checks).every((c) => c !== 'error');
  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'loyala-web',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      checks,
      worker: workerHealth.configured
        ? {
            reachable: workerHealth.reachable,
            service: workerHealth.service,
            inngest: workerHealth.inngest,
            latencyMs: workerHealth.latencyMs,
          }
        : null,
      latencyMs: Date.now() - started,
    },
    { status }
  );
}
