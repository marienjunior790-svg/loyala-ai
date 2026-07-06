import { getWorkerConfig } from './config';
import { isAllowedAiPath, toWorkerAiPath } from './paths';

export { isAllowedAiPath, WORKER_AI_PATHS } from './paths';
export { getWorkerConfig, isWorkerConfigured } from './config';

const REQUEST_TIMEOUT_MS = 30_000;

export interface WorkerHealth {
  configured: boolean;
  reachable: boolean;
  status?: string;
  service?: string;
  inngest?: boolean;
  latencyMs?: number;
  error?: string;
}

export type WorkerProxyResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function authHeaders(secret: string): HeadersInit {
  if (!secret) return {};
  return { Authorization: `Bearer ${secret}` };
}

/** Probe worker /health — no session required. */
export async function getWorkerHealth(): Promise<WorkerHealth> {
  const config = getWorkerConfig();
  if (!config) {
    return { configured: false, reachable: false, error: 'WORKER_URL not configured' };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${config.baseUrl}/health`, {
      headers: authHeaders(config.secret),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        configured: true,
        reachable: false,
        latencyMs: Date.now() - started,
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      status?: string;
      service?: string;
      inngest?: boolean;
    };

    return {
      configured: true,
      reachable: true,
      status: data.status,
      service: data.service,
      inngest: data.inngest,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Worker unreachable',
    };
  }
}

export interface ProxyToWorkerOptions {
  method: string;
  organizationId: string;
  body?: Record<string, unknown>;
}

/** Server-side proxy to worker /ai/* — injects organizationId from session. */
export async function proxyToWorker<T = unknown>(
  subPath: string,
  options: ProxyToWorkerOptions
): Promise<WorkerProxyResult<T>> {
  if (!isAllowedAiPath(subPath)) {
    return { ok: false, status: 404, error: 'Unknown AI route' };
  }

  const config = getWorkerConfig();
  if (!config) {
    return { ok: false, status: 503, error: 'Worker not configured (WORKER_URL)' };
  }

  const workerPath = toWorkerAiPath(subPath);
  const url = new URL(workerPath, `${config.baseUrl}/`);

  const method = options.method.toUpperCase();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeaders(config.secret),
  };

  let fetchBody: string | undefined;
  if (method === 'GET') {
    url.searchParams.set('organizationId', options.organizationId);
  } else {
    fetchBody = JSON.stringify({
      ...options.body,
      organizationId: options.organizationId,
    });
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: fetchBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as T & { error?: string };

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data as { error?: string }).error ?? `Worker error ${res.status}`,
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : 'Worker request failed',
    };
  }
}
