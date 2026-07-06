import { parseWebEnv } from '@loyala/validation';

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';

/** Validate environment at server startup. Fails fast in production runtime. */
export function logWebEnvStatus(): void {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    parseWebEnv(process.env as Record<string, string | undefined>);
    console.info('[loyala-web] Environment validation OK');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      throw new Error(`[loyala-web] Invalid production environment: ${message}`);
    }
    console.warn('[loyala-web] Environment validation warning:', message);
  }
}
