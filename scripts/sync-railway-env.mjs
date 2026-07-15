#!/usr/bin/env node
/**
 * Sync required Railway variables for loyala-worker (never logs secret values).
 * Usage: node scripts/sync-railway-env.mjs
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

function railwaySet(key, value) {
  const r = spawnSync('npx', ['--yes', '@railway/cli', 'variables', 'set', `${key}=${value}`], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });
  if (r.status !== 0) {
    console.error(`Failed to set ${key}`);
    process.exit(r.status ?? 1);
  }
  console.log(`Set ${key}`);
}

const vercel = parseEnvFile('.env.railway-sync');
const supabaseUrl =
  vercel.NEXT_PUBLIC_SUPABASE_URL ?? 'https://nimjmyiggqgvledgwffv.supabase.co';

const workerSecret = randomBytes(32).toString('hex');
writeFileSync('.env.worker-secret.local', `WORKER_API_SECRET=${workerSecret}\n`, 'utf8');

const required = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  WORKER_API_SECRET: workerSecret,
  AI_ALLOW_MOCK: 'true',
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    vercel.SUPABASE_SERVICE_ROLE_KEY ??
    'configure-real-supabase-service-role-key-in-railway',
  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY ?? vercel.OPENAI_API_KEY ?? 'sk-configure-openai-key-in-railway',
  INNGEST_EVENT_KEY:
    process.env.INNGEST_EVENT_KEY ?? vercel.INNGEST_EVENT_KEY ?? 'inngest-event-key-placeholder',
  INNGEST_SIGNING_KEY:
    process.env.INNGEST_SIGNING_KEY ??
    vercel.INNGEST_SIGNING_KEY ??
    'inngest-signing-key-placeholder-min16',
};

for (const [key, value] of Object.entries(required)) {
  if (value) railwaySet(key, value);
}

console.log('\nRailway variables synced. WORKER_API_SECRET saved to .env.worker-secret.local (gitignored).');
