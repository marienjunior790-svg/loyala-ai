export async function register() {
  const { logWebEnvStatus } = await import('./lib/env-runtime');
  logWebEnvStatus();
}
