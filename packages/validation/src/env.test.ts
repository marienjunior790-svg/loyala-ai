import { describe, it, expect } from 'vitest';
import {
  parseSharedEnv,
  parseWorkerEnv,
  parseWebEnv,
  collectWebEnvIssues,
  normalizeWebEnvSource,
  hasCriticalWebEnvIssues,
} from '../src/env';

const prodBase = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
} as const;

describe('env validation', () => {
  it('parses shared AI env with defaults', () => {
    const env = parseSharedEnv({
      NODE_ENV: 'test',
      AI_PRIMARY_PROVIDER: 'openai',
      AI_ALLOW_MOCK: 'true',
    });
    expect(env.AI_MAX_RETRIES).toBe(3);
    expect(env.AI_ALLOW_MOCK).toBe(true);
  });

  it('parseWebEnv does not throw when WORKER_URL is missing in production', () => {
    expect(() =>
      parseWebEnv({
        ...prodBase,
        AI_ALLOW_MOCK: 'true',
      })
    ).not.toThrow();
  });

  it('parseWebEnv does not throw when NEXT_PUBLIC_APP_URL is missing if VERCEL_URL is set', () => {
    const env = parseWebEnv({
      ...prodBase,
      VERCEL_URL: 'loyala-ai-web.vercel.app',
      WORKER_URL: 'https://worker.example.com',
      WORKER_API_SECRET: 'prod-secret-min-16-ch',
      AI_ALLOW_MOCK: 'true',
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://loyala-ai-web.vercel.app');
  });

  it('collectWebEnvIssues flags missing WORKER_URL as feature (not critical)', () => {
    const issues = collectWebEnvIssues({
      ...prodBase,
      AI_ALLOW_MOCK: 'true',
    });
    expect(issues.some((i) => i.variable === 'WORKER_URL' && i.severity === 'feature')).toBe(
      true
    );
    expect(hasCriticalWebEnvIssues(issues)).toBe(false);
    expect(issues.some((i) => i.variable === 'OPENAI_API_KEY')).toBe(false);
  });

  it('collectWebEnvIssues does not require AI keys on web (worker handles AI)', () => {
    const issues = collectWebEnvIssues({
      ...prodBase,
      WORKER_URL: 'https://worker.example.com',
      WORKER_API_SECRET: 'prod-secret-min-16-ch',
      AI_ALLOW_MOCK: 'false',
    });
    expect(issues.some((i) => i.variable === 'OPENAI_API_KEY')).toBe(false);
    expect(issues.some((i) => i.severity === 'feature')).toBe(false);
  });

  it('collectWebEnvIssues flags RESEND as warning only', () => {
    const issues = collectWebEnvIssues({
      ...prodBase,
      VERCEL_URL: 'app.vercel.app',
      WORKER_URL: 'https://worker.example.com',
      WORKER_API_SECRET: 'prod-secret-min-16-ch',
      AI_ALLOW_MOCK: 'true',
    });
    const resend = issues.find((i) => i.variable === 'RESEND_API_KEY');
    expect(resend?.severity).toBe('warning');
  });

  it('collectWebEnvIssues returns critical on invalid Supabase URL', () => {
    const issues = collectWebEnvIssues({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(hasCriticalWebEnvIssues(issues)).toBe(true);
  });

  it('normalizeWebEnvSource derives app URL from VERCEL_URL', () => {
    const normalized = normalizeWebEnvSource({
      VERCEL_URL: 'loyala-ai-web.vercel.app',
    });
    expect(normalized.NEXT_PUBLIC_APP_URL).toBe('https://loyala-ai-web.vercel.app');
  });

  it('collectWebEnvIssues is empty in development without worker', () => {
    const issues = collectWebEnvIssues({
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(issues).toHaveLength(0);
  });

  it('collectWebEnvIssues warns when APP_URL and VERCEL_URL both missing', () => {
    const issues = collectWebEnvIssues({
      ...prodBase,
      AI_ALLOW_MOCK: 'true',
      WORKER_URL: 'https://worker.example.com',
      WORKER_API_SECRET: 'prod-secret-min-16-ch',
    });
    expect(issues.some((i) => i.variable === 'NEXT_PUBLIC_APP_URL')).toBe(true);
  });

  it('parses optional worker vars in development', () => {
    const env = parseWebEnv({
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      WORKER_URL: 'http://localhost:3001',
      WORKER_API_SECRET: 'dev-secret-min-16-ch',
    });
    expect(env.WORKER_URL).toBe('http://localhost:3001');
  });

  it('allows mock provider in test worker env', () => {
    const env = parseWorkerEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      AI_ALLOW_MOCK: 'true',
    });
    expect(env.WORKER_PORT).toBe(3001);
  });

  it('requires worker secret in production worker parse', () => {
    expect(() =>
      parseWorkerEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        INNGEST_EVENT_KEY: 'eventkey-prod-test-key-minimum-length-ok',
        INNGEST_SIGNING_KEY: 'signkey-prod-test-key-minimum-length-ok',
        AI_ALLOW_MOCK: 'true',
      })
    ).toThrow(/WORKER_API_SECRET/);
  });

  it('rejects signing key used as INNGEST_EVENT_KEY in production', () => {
    expect(() =>
      parseWorkerEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        INNGEST_EVENT_KEY: 'signkey-prod-wrong-key-value-here-xx',
        INNGEST_SIGNING_KEY: 'signkey-prod-test-key-minimum-length-ok',
        WORKER_API_SECRET: 'x'.repeat(16),
        AI_ALLOW_MOCK: 'true',
      })
    ).toThrow(/Event Key/);
  });

  it('requires Meta credentials when WHATSAPP_API_ENABLED in production', () => {
    expect(() =>
      parseWorkerEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        INNGEST_EVENT_KEY: 'eventkey-prod-test-key-minimum-length-ok',
        INNGEST_SIGNING_KEY: 'signkey-prod-test-key-minimum-length-ok',
        WORKER_API_SECRET: 'x'.repeat(16),
        AI_ALLOW_MOCK: 'true',
        WHATSAPP_API_ENABLED: 'true',
      })
    ).toThrow(/WHATSAPP_ACCESS_TOKEN/);
  });
});

describe('deployed outage reproduction (d837bf8)', () => {
  it('old fail-fast would throw on typical Vercel env — new code does not', () => {
    const typicalVercel = {
      NODE_ENV: 'production',
      VERCEL_URL: 'loyala-ai-web.vercel.app',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      AI_ALLOW_MOCK: 'false',
    };

    expect(() => parseWebEnv(typicalVercel)).not.toThrow();

    const issues = collectWebEnvIssues(typicalVercel);
    expect(issues.some((i) => i.variable === 'WORKER_URL')).toBe(true);
    expect(hasCriticalWebEnvIssues(issues)).toBe(false);
  });
});
