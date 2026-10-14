import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, parseUpstashCount } from './rate-limit';

describe('rate limit', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('parses Upstash REST replies', () => {
    expect(parseUpstashCount('{"result":3}')).toBe(3);
    expect(parseUpstashCount('7')).toBe(7);
    expect(Number.isNaN(parseUpstashCount('oops'))).toBe(true);
  });

  it('falls back to memory when Upstash is unreachable', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://gone.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await checkRateLimit('test:unreachable', { limit: 1, windowSec: 60 });
    const second = await checkRateLimit('test:unreachable', { limit: 1, windowSec: 60 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });

  it('counts with Upstash when it answers', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://ok.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"result":6}', { status: 200 }))
    );

    const result = await checkRateLimit('test:upstash', { limit: 5, windowSec: 60 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
