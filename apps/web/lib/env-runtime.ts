import { parseWebEnv } from '@loyala/validation';

/** Log environment issues at server startup without crashing the build. */
export function logWebEnvStatus(): void {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    parseWebEnv(process.env as Record<string, string | undefined>);
    console.info('[loyala-web] Environment validation OK');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[loyala-web] Environment validation warning:', message);
  }
}
