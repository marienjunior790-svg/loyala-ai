#!/usr/bin/env node
/**
 * Post-DNS migration validation for fmagence.online → Vercel.
 * Usage: node scripts/verify-fmagence-domain.mjs
 */
const ORIGIN = process.env.PRODUCTION_SMOKE_URL ?? 'https://fmagence.online';

const checks = [
  { name: 'home', path: '/', expectHtml: true },
  { name: 'login', path: '/login', expectHtml: true },
  { name: 'health', path: '/api/health', expectJson: true },
];

let failed = 0;
for (const c of checks) {
  const url = `${ORIGIN}${c.path}`;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    let pass = res.status >= 200 && res.status < 400;
    let detail = `HTTP ${res.status}`;

    if (c.expectJson && res.headers.get('content-type')?.includes('json')) {
      const j = await res.json();
      detail += ` service=${j.service ?? 'n/a'} status=${j.status ?? 'n/a'}`;
    } else if (c.expectHtml) {
      const t = await res.text();
      if (t.includes('Page par défaut') || t.toLowerCase().includes('default page')) {
        detail += ' (Hostinger default page — DNS not on Vercel yet)';
        pass = false;
      } else if (t.includes('Loyala') || t.includes('loyala')) {
        detail += ' (Loyala app OK)';
      } else {
        detail += ' (unknown HTML)';
        pass = false;
      }
    }

    console.log(`${pass ? '✅' : '❌'} ${c.name}: ${detail}`);
    if (!pass) failed++;
  } catch (e) {
    console.log(`❌ ${c.name}: ${e.message}`);
    failed++;
  }
}

process.exit(failed ? 1 : 0);
