/** Enable with AUTH_DEBUG=1 on Vercel or locally */
export function authDebug(label: string, data: Record<string, unknown>): void {
  if (process.env.AUTH_DEBUG !== '1') return;
  console.info(`[auth:${label}]`, JSON.stringify(data));
}
