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

const memoryBuckets = new Map<string, Bucket>();

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

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const windowMs = windowSec * 1000;
  const now = Date.now();
  const bucketKey = `rl:${key}:${Math.floor(now / windowMs)}`;

  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(bucketKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!incrRes.ok) return null;

  const count = Number(await incrRes.text());
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(bucketKey)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  return {
    ok: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
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
  if (upstash) return upstash;

  if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
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
