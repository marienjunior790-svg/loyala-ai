import { describe, it, expect } from 'vitest';
import { parseSharedEnv, parseWorkerEnv, parseWebEnv } from '../src/env';

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

  it('requires OpenAI key when primary is openai in production', () => {
    expect(() =>
      parseWebEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        AI_PRIMARY_PROVIDER: 'openai',
        AI_ALLOW_MOCK: 'false',
      })
    ).toThrow(/OPENAI_API_KEY/);
  });

  it('requires worker URL and secret in production', () => {
    expect(() =>
      parseWebEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        AI_ALLOW_MOCK: 'true',
      })
    ).toThrow(/WORKER_URL/);
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

  it('allows mock provider in test', () => {
    const env = parseWorkerEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      AI_ALLOW_MOCK: 'true',
    });
    expect(env.WORKER_PORT).toBe(3001);
  });
});
