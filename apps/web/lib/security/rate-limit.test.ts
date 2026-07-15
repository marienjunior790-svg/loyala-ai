import { afterEach, describe, expect, it, vi } from 'vitest';

describe('checkRateLimit', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses in-memory limiter in development when Upstash is absent', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = 'development';
    process.env.RATE_LIMIT_API_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_SEC = '60';

    const { checkRateLimit } = await import('./rate-limit');
    const key = `dev-${Date.now()}`;

    expect((await checkRateLimit(key)).ok).toBe(true);
    expect((await checkRateLimit(key)).ok).toBe(true);
    expect((await checkRateLimit(key)).ok).toBe(false);
  });

  it('uses Upstash when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.RATE_LIMIT_API_MAX = '5';

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/incr/')) {
        return new Response('1', { status: 200 });
      }
      if (url.includes('/expire/')) {
        return new Response('1', { status: 200 });
      }
      return new Response('ERR', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('upstash-key');

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(fetchMock).toHaveBeenCalled();
    const [incrUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(incrUrl)).toContain('https://example.upstash.io/incr/');
    expect((init as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer token',
    });
  });

  it('fail-opens when Upstash is configured but unreachable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ERR', { status: 503 }))
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('fail-open-key');

    expect(result.ok).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('isUpstashConfigured', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  it('returns true only when URL and token are set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    const { isUpstashConfigured } = await import('./rate-limit');
    expect(isUpstashConfigured()).toBe(true);
  });
});
