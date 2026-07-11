#!/usr/bin/env node
/**
 * Production verification — routes + /api/health diagnostics.
 * Usage: node scripts/verify-production.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'https://fmagence.online';

const routes = [
  '/',
  '/signup',
  '/login',
  '/dashboard',
  '/clients',
  '/campaigns',
  '/loyalty',
  '/reviews',
  '/analytics',
  '/notifications',
  '/billing',
  '/settings',
  '/api/health',
  '/robots.txt',
  '/sitemap.xml',
];

async function probe(path) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    return { path, status: res.status, ok: res.status < 500 };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`\n=== Loyala AI production probe: ${base} ===\n`);

  const healthRes = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
  const health = await healthRes.json().catch(() => ({}));
  console.log('Health:', healthRes.status, JSON.stringify(health, null, 2));

  console.log('\n--- Routes ---');
  for (const path of routes) {
    const r = await probe(path);
    const flag = r.ok ? 'OK' : 'FAIL';
    console.log(`${flag}  ${r.status}\t${path}${r.error ? ` (${r.error})` : ''}`);
  }

  const failed = (await Promise.all(routes.map(probe))).filter((r) => !r.ok);
  process.exit(failed.length > 0 || health.status !== 'ok' ? 1 : 0);
}

main();
