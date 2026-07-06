import { describe, it, expect, vi, afterEach } from 'vitest';
import { logWebEnvStatus, getWebEnvDiagnostics } from './env-runtime';

describe('env-runtime startup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logWebEnvStatus never throws when WORKER_URL is missing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('VERCEL_URL', 'loyala-ai-web.vercel.app');
    vi.stubEnv('AI_ALLOW_MOCK', 'true');

    expect(() => logWebEnvStatus()).not.toThrow();
  });

  it('getWebEnvDiagnostics lists missing worker without critical flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('AI_ALLOW_MOCK', 'true');

    const diag = getWebEnvDiagnostics();
    expect(diag.critical).toBe(false);
    expect(diag.missingVariables).toContain('WORKER_URL');
  });

  it('getWebEnvDiagnostics marks invalid schema as critical', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'bad-url');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');

    const diag = getWebEnvDiagnostics();
    expect(diag.critical).toBe(true);
  });
});
