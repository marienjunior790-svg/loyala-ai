export async function register() {
  const { logWebEnvStatus } = await import('./lib/env-runtime');
  const { reportStartup } = await import('./lib/monitoring/error-report');
  logWebEnvStatus();
  reportStartup();
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  _context: { routerKind: string }
) {
  const { reportError } = await import('./lib/monitoring/error-report');
  reportError(error, {
    source: 'onRequestError',
    path: `${request.method} ${request.path}`,
  });
}
