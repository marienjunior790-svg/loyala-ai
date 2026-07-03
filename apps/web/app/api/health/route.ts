import { NextResponse } from 'next/server';

export async function GET() {
  const started = Date.now();
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {
    supabase: 'skipped',
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.supabase = res.ok || res.status === 404 ? 'ok' : 'error';
    } catch {
      checks.supabase = 'error';
    }
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
      latencyMs: Date.now() - started,
    },
    { status }
  );
}
