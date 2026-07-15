#!/usr/bin/env node
/** Post-deploy HTTP verification for Hostinger — facts only */
const base = process.argv[2] ?? 'https://fmagence.online';

const routes = [
  { path: '/', expect: [200], label: 'Home' },
  { path: '/login', expect: [200], label: 'Login' },
  { path: '/dashboard', expect: [200, 307, 302], label: 'Dashboard' },
  { path: '/api/health', expect: [200], label: 'Health API' },
];

async function probe(path) {
  const url = `${base}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    const title = text.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
    return { path, status: res.status, ms: Date.now() - started, title, isHostingerDefault: /Page par d.faut|Hostinger/i.test(text) };
  } catch (error) {
    return { path, status: 0, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(`\n=== Deploy verification: ${base} ===\n`);
let failed = 0;

for (const route of routes) {
  const r = await probe(route.path);
  const ok = route.expect.includes(r.status) && !r.isHostingerDefault;
  if (!ok) failed++;
  const flag = ok ? 'PASS' : 'FAIL';
  console.log(`${flag}  ${r.status || 'ERR'}\t${route.path}\t${route.label}${r.title ? ` — "${r.title}"` : ''}${r.isHostingerDefault ? ' [Hostinger default page]' : ''}${r.error ? ` (${r.error})` : ''}`);
}

console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
