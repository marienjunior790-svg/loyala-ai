import { logStructured, pingHeartbeat } from '@loyala/integrations';

export interface ErrorReportContext {
  source: string;
  digest?: string;
  path?: string;
}

/** Central error reporting — structured JSON logs (Vercel/Railway log drains). */
export function reportError(error: unknown, context: ErrorReportContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logStructured({
    level: 'error',
    service: 'loyala-web',
    message,
    context: {
      ...context,
      stack: process.env.NODE_ENV === 'production' ? undefined : stack,
    },
  });
}

export function reportStartup(): void {
  logStructured({
    level: 'info',
    service: 'loyala-web',
    message: 'Application started',
    context: { nodeEnv: process.env.NODE_ENV },
  });
  void pingHeartbeat('loyala-web');
}
