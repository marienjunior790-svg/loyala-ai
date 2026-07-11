import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { withRateLimit } from '@/lib/security/api-guard';
import { isAllowedAiPath, proxyToWorker } from '@/lib/worker/client';
import type { WorkerAiPath } from '@/lib/worker/paths';

export async function handleAiProxyForPath(
  request: Request,
  subPath: WorkerAiPath
): Promise<NextResponse> {
  return withRateLimit(request, async () => {
    const ctx = await getAuthContext();
    if (!ctx?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAllowedAiPath(subPath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const result = await proxyToWorker(subPath, {
      method: request.method,
      organizationId: ctx.organizationId,
      body,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  }, 'ai-proxy');
}
