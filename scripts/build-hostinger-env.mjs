#!/usr/bin/env node
/** Build Hostinger .env from Vercel + Railway + local (logs key names only). */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function getVercelEnv(key) {
  const r = spawnSync('npx', ['--yes', 'vercel', 'env', 'get', key, 'production'], {
    encoding: 'utf8',
    shell: true,
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const val = (r.stdout ?? '').trim();
  return val && !val.toLowerCase().includes('error') ? val : '';
}

const desktop = join(homedir(), 'Desktop', 'fmagence-hostinger.env');
const root = process.cwd();

const localWorker = existsSync(join(root, '.env.worker-secret.local'))
  ? parseEnv(readFileSync(join(root, '.env.worker-secret.local'), 'utf8'))
  : {};

const vercelPull = {};
for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'WORKER_URL',
  'WORKER_API_SECRET',
  'NEXT_PUBLIC_DEMO_WHATSAPP',
  'AUTH_DEBUG',
]) {
  const val = getVercelEnv(key);
  if (val) vercelPull[key] = val;
}

let railwayVars = {};
const railway = spawnSync('npx', ['--yes', '@railway/cli', 'variables', '--json'], {
  encoding: 'utf8',
  shell: true,
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (railway.status === 0 && railway.stdout) {
  try {
    railwayVars = JSON.parse(railway.stdout);
  } catch {
    /* ignore */
  }
}

const merged = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_URL: 'https://fmagence.online',
  NEXT_PUBLIC_SITE_URL: 'https://fmagence.online',
  NEXT_PUBLIC_SUPABASE_URL:
    vercelPull.NEXT_PUBLIC_SUPABASE_URL ?? railwayVars.NEXT_PUBLIC_SUPABASE_URL ?? '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: vercelPull.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: railwayVars.SUPABASE_SERVICE_ROLE_KEY ?? '',
  WORKER_URL:
    vercelPull.WORKER_URL ??
    (railwayVars.RAILWAY_PUBLIC_DOMAIN
      ? `https://${railwayVars.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://loyala-worker-production.up.railway.app'),
  WORKER_API_SECRET:
    vercelPull.WORKER_API_SECRET ??
    localWorker.WORKER_API_SECRET ??
    railwayVars.WORKER_API_SECRET ??
    '',
  NEXT_PUBLIC_DEMO_WHATSAPP: vercelPull.NEXT_PUBLIC_DEMO_WHATSAPP ?? '',
  AUTH_DEBUG: vercelPull.AUTH_DEBUG ?? '0',
};

const HOSTINGER_KEYS = [
  'NODE_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'WORKER_URL',
  'WORKER_API_SECRET',
  'NEXT_PUBLIC_DEMO_WHATSAPP',
  'AUTH_DEBUG',
];

const lines = [
  '# Loyala AI — Hostinger (généré automatiquement)',
  '# Importez via hPanel → Importer un fichier .env',
  '',
];

const missing = [];
for (const key of HOSTINGER_KEYS) {
  const val = merged[key];
  if (!val) {
    if (
      [
        'NODE_ENV',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'WORKER_URL',
        'WORKER_API_SECRET',
        'NEXT_PUBLIC_APP_URL',
      ].includes(key)
    ) {
      missing.push(key);
    }
    continue;
  }
  lines.push(`${key}=${val}`);
}

writeFileSync(desktop, `${lines.join('\n')}\n`, 'utf8');
console.log(`Fichier écrit : ${desktop}`);
console.log(`Variables incluses : ${lines.filter((l) => l.includes('=')).length}`);
if (missing.length) {
  console.log(`Manquantes : ${missing.join(', ')}`);
  console.log('→ Copiez NEXT_PUBLIC_SUPABASE_ANON_KEY depuis Vercel ou Supabase Dashboard.');
} else {
  console.log('Toutes les variables critiques sont présentes.');
}
