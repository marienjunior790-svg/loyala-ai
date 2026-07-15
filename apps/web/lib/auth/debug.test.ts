import { afterEach, describe, expect, it, vi } from 'vitest';

describe('authDebug', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logs when AUTH_DEBUG=1 in development', async () => {
    process.env.AUTH_DEBUG = '1';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { authDebug, isAuthDebugEnabled } = await import('./debug');
    expect(isAuthDebugEnabled()).toBe(true);
    authDebug('test', { ok: true });
    expect(info).toHaveBeenCalledWith('[auth:test]', '{"ok":true}');
  });

  it('never logs on Vercel production even if AUTH_DEBUG=1', async () => {
    process.env.AUTH_DEBUG = '1';
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { authDebug, isAuthDebugEnabled } = await import('./debug');
    expect(isAuthDebugEnabled()).toBe(false);
    authDebug('test', { ok: true });
    expect(info).not.toHaveBeenCalled();
  });

  it('allows AUTH_DEBUG on Vercel preview', async () => {
    process.env.AUTH_DEBUG = '1';
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'preview';

    const { isAuthDebugEnabled } = await import('./debug');
    expect(isAuthDebugEnabled()).toBe(true);
  });

  it('is off when AUTH_DEBUG is unset', async () => {
    delete process.env.AUTH_DEBUG;
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;

    const { isAuthDebugEnabled } = await import('./debug');
    expect(isAuthDebugEnabled()).toBe(false);
  });
});
