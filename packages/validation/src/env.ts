import { z } from 'zod';

const providerSchema = z.enum(['openai', 'anthropic', 'mock']);

export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_PRIMARY_PROVIDER: providerSchema.default('openai'),
  AI_FALLBACK_PROVIDER: providerSchema.default('anthropic'),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(3600),
  AI_MAX_COST_USD: z.coerce.number().positive().default(0.05),
  AI_ALLOW_MOCK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
  BETTERSTACK_HEARTBEAT_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export const webEnvSchema = sharedEnvSchema.extend({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  WORKER_URL: z.string().url().optional(),
  WORKER_API_SECRET: z.string().min(16).optional(),
});

export const workerEnvSchema = sharedEnvSchema.extend({
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_DEV: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  WORKER_API_SECRET: z.string().min(16).optional(),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function assertAIKeys(env: SharedEnv, context: string): void {
  if (env.AI_ALLOW_MOCK || env.NODE_ENV === 'test') return;

  const primary = env.AI_PRIMARY_PROVIDER;
  const fallback = env.AI_FALLBACK_PROVIDER;

  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);

  if (primary === 'openai' && !hasOpenAI) {
    throw new Error(`[${context}] Missing OPENAI_API_KEY (AI_PRIMARY_PROVIDER=openai)`);
  }
  if (primary === 'anthropic' && !hasAnthropic) {
    throw new Error(`[${context}] Missing ANTHROPIC_API_KEY (AI_PRIMARY_PROVIDER=anthropic)`);
  }
  if (fallback === 'anthropic' && !hasAnthropic && !env.AI_ALLOW_MOCK) {
    throw new Error(`[${context}] Missing ANTHROPIC_API_KEY (AI_FALLBACK_PROVIDER=anthropic)`);
  }
  if (fallback === 'openai' && !hasOpenAI && !env.AI_ALLOW_MOCK) {
    throw new Error(`[${context}] Missing OPENAI_API_KEY (AI_FALLBACK_PROVIDER=openai)`);
  }
  if (!hasOpenAI && !hasAnthropic && !env.AI_ALLOW_MOCK) {
    throw new Error(
      `[${context}] At least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is required in production`
    );
  }
}

export function parseWebEnv(source: Record<string, string | undefined>): WebEnv {
  const env = webEnvSchema.parse(source);
  if (env.NODE_ENV === 'production') {
    assertAIKeys(env, 'web');
    if (!env.WORKER_URL) {
      throw new Error('[web] WORKER_URL required in production');
    }
    if (!env.WORKER_API_SECRET) {
      throw new Error('[web] WORKER_API_SECRET required in production (min 16 chars)');
    }
  }
  return env;
}

export function parseWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  const env = workerEnvSchema.parse(source);
  if (env.NODE_ENV === 'production') {
    assertAIKeys(env, 'worker');
    if (!env.INNGEST_EVENT_KEY || !env.INNGEST_SIGNING_KEY) {
      throw new Error(
        '[worker] INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY required in production'
      );
    }
    if (!env.WORKER_API_SECRET) {
      throw new Error('[worker] WORKER_API_SECRET required in production (min 16 chars)');
    }
  }
  return env;
}

export function parseSharedEnv(source: Record<string, string | undefined>): SharedEnv {
  return sharedEnvSchema.parse(source);
}
