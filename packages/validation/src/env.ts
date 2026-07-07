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
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
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

export type EnvIssueSeverity = 'critical' | 'feature' | 'warning';

export interface WebEnvIssue {
  variable: string;
  severity: EnvIssueSeverity;
  message: string;
}

/** Normalize raw process.env — safe fallbacks for Vercel runtime. */
export function normalizeWebEnvSource(
  source: Record<string, string | undefined>
): Record<string, string | undefined> {
  return {
    ...source,
    NEXT_PUBLIC_APP_URL:
      source.NEXT_PUBLIC_APP_URL ??
      (source.VERCEL_URL ? `https://${source.VERCEL_URL}` : undefined),
  };
}

function collectAIKeyIssues(env: SharedEnv, context: string): WebEnvIssue[] {
  if (env.AI_ALLOW_MOCK || env.NODE_ENV === 'test') return [];

  const issues: WebEnvIssue[] = [];
  const primary = env.AI_PRIMARY_PROVIDER;
  const fallback = env.AI_FALLBACK_PROVIDER;
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);

  if (primary === 'openai' && !hasOpenAI) {
    issues.push({
      variable: 'OPENAI_API_KEY',
      severity: 'feature',
      message: `[${context}] Missing OPENAI_API_KEY (AI_PRIMARY_PROVIDER=openai)`,
    });
  }
  if (primary === 'anthropic' && !hasAnthropic) {
    issues.push({
      variable: 'ANTHROPIC_API_KEY',
      severity: 'feature',
      message: `[${context}] Missing ANTHROPIC_API_KEY (AI_PRIMARY_PROVIDER=anthropic)`,
    });
  }
  if (fallback === 'anthropic' && !hasAnthropic && !env.AI_ALLOW_MOCK) {
    issues.push({
      variable: 'ANTHROPIC_API_KEY',
      severity: 'feature',
      message: `[${context}] Missing ANTHROPIC_API_KEY (AI_FALLBACK_PROVIDER=anthropic)`,
    });
  }
  if (fallback === 'openai' && !hasOpenAI && !env.AI_ALLOW_MOCK) {
    issues.push({
      variable: 'OPENAI_API_KEY',
      severity: 'feature',
      message: `[${context}] Missing OPENAI_API_KEY (AI_FALLBACK_PROVIDER=openai)`,
    });
  }
  if (!hasOpenAI && !hasAnthropic && !env.AI_ALLOW_MOCK) {
    issues.push({
      variable: 'OPENAI_API_KEY',
      severity: 'feature',
      message: `[${context}] At least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is required in production`,
    });
  }
  return issues;
}

/**
 * Parse web env (Zod schema only). Never throws for missing optional integrations —
 * use collectWebEnvIssues() for production readiness checks.
 */
export function parseWebEnv(source: Record<string, string | undefined>): WebEnv {
  return webEnvSchema.parse(normalizeWebEnvSource(source));
}

/**
 * Non-throwing production readiness audit.
 * Critical = app cannot serve auth/CRM. Feature = AI/worker degraded. Warning = optional.
 */
export function collectWebEnvIssues(
  source: Record<string, string | undefined>
): WebEnvIssue[] {
  const normalized = normalizeWebEnvSource(source);
  let env: WebEnv;

  try {
    env = webEnvSchema.parse(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        variable: 'WEB_ENV_SCHEMA',
        severity: 'critical',
        message: `[web] Invalid environment schema: ${message}`,
      },
    ];
  }

  if (env.NODE_ENV !== 'production') return [];

  const issues: WebEnvIssue[] = [];

  // AI keys are validated on the worker — web proxies to WORKER_URL only.
  if (!env.WORKER_URL) {
    issues.push({
      variable: 'WORKER_URL',
      severity: 'feature',
      message: '[web] WORKER_URL not set — AI proxy and campaigns unavailable',
    });
  }
  if (env.WORKER_URL && !env.WORKER_API_SECRET) {
    issues.push({
      variable: 'WORKER_API_SECRET',
      severity: 'feature',
      message: '[web] WORKER_API_SECRET not set (min 16 chars) — worker auth disabled',
    });
  }
  if (!env.NEXT_PUBLIC_APP_URL) {
    issues.push({
      variable: 'NEXT_PUBLIC_APP_URL',
      severity: 'warning',
      message:
        '[web] NEXT_PUBLIC_APP_URL not set and VERCEL_URL unavailable — SEO canonical URLs degraded',
    });
  }
  if (source.AUTH_DEBUG === '1') {
    issues.push({
      variable: 'AUTH_DEBUG',
      severity: 'warning',
      message: '[web] AUTH_DEBUG=1 enabled in production — disable after incident investigation',
    });
  }
  if (!source.RESEND_API_KEY) {
    issues.push({
      variable: 'RESEND_API_KEY',
      severity: 'warning',
      message: '[web] RESEND_API_KEY not set — transactional email disabled',
    });
  }
  if (!source.UPSTASH_REDIS_REST_URL || !source.UPSTASH_REDIS_REST_TOKEN) {
    issues.push({
      variable: 'UPSTASH_REDIS_REST_URL',
      severity: 'warning',
      message:
        '[web] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting uses in-memory fallback',
    });
  }

  return issues;
}

export function hasCriticalWebEnvIssues(issues: WebEnvIssue[]): boolean {
  return issues.some((i) => i.severity === 'critical');
}

export function parseWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  const env = workerEnvSchema.parse(source);
  if (env.NODE_ENV === 'production') {
    const aiIssues = collectAIKeyIssues(env, 'worker');
    if (aiIssues.length > 0) {
      throw new Error(aiIssues[0]!.message);
    }
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
