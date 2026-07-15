#!/usr/bin/env node
/**
 * Pre-deploy readiness report — facts only, no assumptions.
 * Usage: node scripts/hostinger-readiness-report.mjs [zipPath] [probeBaseUrl]
 */
import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const zipPath = process.argv[2] ?? join(ROOT, 'hostinger-export-new.zip');
const probeBase = process.argv[3] ?? 'https://fmagence.online';

const REQUIRED = [
  'package.json',
  'package-lock.json',
  'server.js',
  '.env.example',
  'next.config.ts',
  '.next/standalone/server.js',
];

function zipHas(path) {
  if (!existsSync(zipPath)) return false;
  const out = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const target = path.replace(/^\.\//, '');
  return out.split('\n').some((line) => {
    const n = line.replace(/^\.\//, '').replace(/\/$/, '');
    return n === target || n.endsWith(`/${target}`);
  });
}

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, ms: Date.now() - started, body: text.slice(0, 500) };
  } catch (error) {
    return {
      url,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

console.log('═'.repeat(72));
console.log(' LOYALA AI — HOSTINGER READINESS REPORT (verified facts)');
console.log('═'.repeat(72));
console.log(`Generated: ${new Date().toISOString()}\n`);

// Phase 1 — Archive
console.log('## PHASE 1 — Archive\n');
if (!existsSync(zipPath)) {
  console.log(`❌ ZIP missing: ${zipPath}`);
} else {
  const mb = (statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ ZIP exists: ${zipPath} (${mb} Mo)`);
  for (const f of REQUIRED) {
    console.log(`${zipHas(f) ? '✅' : '❌'} ${f}`);
  }
  const hasPublic = zipHas('public/') || zipHas('public/.gitkeep');
  console.log(`${hasPublic ? '✅' : '⚠️'} public/ (${hasPublic ? 'present' : 'missing — regenerate zip'})`);
  console.log(`${zipHas('next.config.js') ? '✅' : 'ℹ️'} next.config.js (project uses next.config.ts — supported by Next.js)`);
}

// Phase 2 — Hostinger platform (documented)
console.log('\n## PHASE 2 — Hostinger constraints (official docs)\n');
console.log('✅ Node versions supported: 18.x, 20.x, 22.x, 24.x');
console.log('✅ Next.js listed as supported framework');
console.log('✅ Plans: Business Web Hosting, Cloud Startup+');
console.log('✅ Business tier: ~2 vCPU, 3 GB RAM, 50 GB NVMe');
console.log('✅ Cloud Startup: ~4 vCPU, 4 GB RAM, 100 GB NVMe');
console.log('✅ Root directory: / (archive root)');
console.log('✅ Build files stored outside public_html in /nodejs');
console.log('ℹ️ No published hard build timeout — limited by plan RAM/CPU');
console.log('ℹ️ Zip upload max not published — current archive ~46 Mo');

// Phase 3 — External services (probed now)
console.log('\n## PHASE 3 — External services (live probes)\n');

const health = await probe(`${probeBase}/api/health`);
console.log(`Vercel reference ${probeBase}/api/health → HTTP ${health.status} (${health.ms}ms)`);
if (health.status === 200) {
  try {
    const j = JSON.parse(health.body);
    console.log(`  status=${j.status} supabase=${j.checks?.supabase} worker=${j.checks?.worker}`);
  } catch { /* */ }
}

const worker = await probe('https://loyala-worker-production.up.railway.app/health');
console.log(`Worker /health → HTTP ${worker.status} (${worker.ms}ms)`);
if (worker.status === 200) {
  try {
    const j = JSON.parse(worker.body);
    console.log(`  service=${j.service} inngest=${j.inngest}`);
  } catch { /* */ }
}

const routes = ['/', '/login', '/dashboard', '/api/health', '/api/metrics/ai'];
console.log('\nRoute probes (reference deployment):');
for (const path of routes) {
  const r = await probe(`${probeBase}${path}`);
  console.log(`  ${r.status || 'ERR'}\t${path}${r.error ? ` (${r.error})` : ''}`);
}

// Phase 6 — Env checklist
console.log('\n## PHASE 6 — Environment variables (Hostinger panel)\n');
const envVars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, example: 'https://nimjmyiggqgvledgwffv.supabase.co' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, example: 'eyJ... (anon JWT from Supabase)' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, example: 'eyJ... (service_role JWT)' },
  { name: 'NEXT_PUBLIC_APP_URL', required: true, example: 'https://VOTRE-DOMAINE.com' },
  { name: 'WORKER_URL', required: true, example: 'https://loyala-worker-production.up.railway.app' },
  { name: 'WORKER_API_SECRET', required: true, example: 'min 16 chars — same as Railway' },
  { name: 'NODE_ENV', required: true, example: 'production' },
  { name: 'RESEND_API_KEY', required: false, example: 're_...' },
  { name: 'UPSTASH_REDIS_REST_URL', required: false, example: 'https://....upstash.io' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: false, example: 'token' },
];

for (const v of envVars) {
  console.log(`${v.required ? '🔴' : '🟡'} ${v.name} — ${v.required ? 'OBLIGATOIRE' : 'optionnel'} — ${v.example}`);
}

console.log('\n## PHASE 9 — Hostinger deployment\n');
console.log('❌ hPanel access blocked — login required at auth.hostinger.com');
console.log('   Upload URL: hpanel.hostinger.com/.../node-file-upload');
console.log('   Account hint from URL: u209092841');
console.log('\n## Hostinger panel settings (after login)\n');
console.log('  Install:  npm install');
console.log('  Build:    npm run build');
console.log('  Start:    npm start');
console.log('  Entry:    server.js');
console.log('  Node:     20.x');
console.log('  Framework: Next.js');

console.log('\n' + '═'.repeat(72));
