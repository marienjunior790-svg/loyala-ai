/**
 * Rate limiting — production uses Upstash Redis when configured.
 * In-memory fallback for dev/single-instance only (not safe multi-replica).
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const UPSTASH_TIMEOUT_MS = 3000;
const memoryBuckets = new Map<string, Bucket>();

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);

  return {
    ok: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetAt,
  };
}

function upstashBaseUrl(): string | null {
  const raw = process.env.UPSTASH_REDIS_REST_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

async function upstashRest(
  command: string,
  ...args: string[]
): Promise<{ ok: true; value: string } | { ok: false; status?: number }> {
  const baseUrl = upstashBaseUrl();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return { ok: false };

  const path = [command, ...args.map((arg) => encodeURIComponent(arg))].join('/');
  try {
    const res = await fetch(`${baseUrl}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, value: await res.text() };
  } catch {
    return { ok: false };
  }
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult | 'error' | null> {
  if (!isUpstashConfigured()) return null;

  const windowMs = windowSec * 1000;
  const now = Date.now();
  const bucketKey = `rl:${key}:${Math.floor(now / windowMs)}`;

  const incrRes = await upstashRest('incr', bucketKey);
  if (!incrRes.ok) return 'error';

  const count = Number(incrRes.value);
  if (!Number.isFinite(count)) return 'error';

  if (count === 1) {
    await upstashRest('expire', bucketKey, String(windowSec));
  }

  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  return {
    ok: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/** Fail-open when Redis is configured but unreachable (avoid per-replica memory drift). */
function failOpenRateLimit(limit: number, windowSec: number): RateLimitResult {
  const windowMs = windowSec * 1000;
  return {
    ok: true,
    limit,
    remaining: limit,
    resetAt: Date.now() + windowMs,
  };
}

export async function checkRateLimit(
  identifier: string,
  options?: { limit?: number; windowSec?: number }
): Promise<RateLimitResult> {
  const limit = options?.limit ?? Number(process.env.RATE_LIMIT_API_MAX ?? 60);
  const windowSec = options?.windowSec ?? Number(process.env.RATE_LIMIT_WINDOW_SEC ?? 60);
  const windowMs = windowSec * 1000;

  const upstash = await upstashRateLimit(identifier, limit, windowSec);
  if (upstash && upstash !== 'error') return upstash;

  if (upstash === 'error') {
    console.error(
      '[rate-limit] Upstash request failed — allowing request (fail-open, no per-replica fallback)'
    );
    return failOpenRateLimit(limit, windowSec);
  }

  if (process.env.NODE_ENV === 'production' && !isUpstashConfigured()) {
    console.warn('[rate-limit] UPSTASH not configured — using in-memory (not safe at scale)');
  }

  return memoryRateLimit(identifier, limit, windowMs);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
