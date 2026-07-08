#!/usr/bin/env node
/**
 * Apply CRM schema repairs (016 + 017) to production Supabase.
 * Requires DATABASE_URL or SUPABASE_ACCESS_TOKEN — never logs secrets.
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/sync-crm-schema-production.mjs
 *   $env:DATABASE_URL="postgresql://..."; node scripts/sync-crm-schema-production.mjs
 */
import { readFile, readFileSync, existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) process.env[key] = val;
  }
}

for (const envFile of ['.env.local', '.env.railway-sync', '.env.worker-secret.local', '.supabase-token.local']) {
  loadDotEnv(join(process.cwd(), envFile));
}

const localTokenFile = join(process.cwd(), '.supabase-token.local');
if (!process.env.SUPABASE_ACCESS_TOKEN && existsSync(localTokenFile)) {
  const raw = readFileSync(localTokenFile, 'utf8').trim();
  const token = raw.startsWith('SUPABASE_ACCESS_TOKEN=')
    ? raw.slice('SUPABASE_ACCESS_TOKEN='.length).trim()
    : raw;
  if (token) process.env.SUPABASE_ACCESS_TOKEN = token;
}

const cliTokenPath = join(homedir(), '.supabase', 'access-token');
if (!process.env.SUPABASE_ACCESS_TOKEN && existsSync(cliTokenPath)) {
  process.env.SUPABASE_ACCESS_TOKEN = readFileSync(cliTokenPath, 'utf8').trim();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'nimjmyiggqgvledgwffv';
const MIGRATIONS = ['016_repair_campaigns_crud.sql', '017_align_crm_schema_gaps.sql'];

async function runQuery(query, { databaseUrl, token }) {
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query(query);
    } finally {
      await client.end();
    }
    return true;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Management API error:', res.status, text.slice(0, 600));
    return false;
  }
  return true;
}

function chunkSql(sql) {
  return sql
    .split(/^-- ───/m)
    .map((c, i) => (i === 0 ? c : `-- ───${c}`))
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

async function applyFile(file, creds) {
  const sql = await readFileAsync(join(__dirname, '..', 'supabase', 'migrations', file), 'utf8');
  const chunks = chunkSql(sql);
  console.log(`\n=== ${file} (${chunks.length} chunks) ===\n`);
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks[i].split('\n')[0]?.slice(0, 70) ?? `chunk ${i + 1}`;
    console.log(`[${i + 1}/${chunks.length}] ${label}`);
    if (!(await runQuery(chunks[i], creds))) {
      console.error(`FAILED ${file} at chunk ${i + 1}`);
      return false;
    }
  }
  console.log(`OK ${file}`);
  return true;
}

const databaseUrl = process.env.DATABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!databaseUrl && !token) {
  console.error(
    'Aucun identifiant DDL disponible (DATABASE_URL ou SUPABASE_ACCESS_TOKEN).\n\n' +
      'Étape 1 — Authentifier Supabase CLI (une fois, interactif) :\n' +
      '  npm run db:supabase-login\n' +
      '  (ou: powershell -File scripts/supabase-login.ps1)\n' +
      '  Important: --output-format text --agent no (évite NonInteractiveError)\n\n' +
      'Étape 2 — Appliquer les migrations :\n' +
      '  npm run db:sync-crm\n\n' +
      'Alternative — SQL Editor (sans CLI) :\n' +
      `  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n` +
      '  Exécuter : supabase/migrations/017_align_crm_schema_gaps.sql\n\n' +
      'Alternative — Railway (recommandé pour CI) :\n' +
      '  Ajouter DATABASE_URL dans Railway → loyala-worker → Variables\n' +
      '  (Supabase → Project Settings → Database → Connection string URI)\n' +
      '  puis : npx @railway/cli run --service loyala-worker node scripts/sync-crm-schema-production.mjs'
  );
  process.exit(2);
}

const creds = { databaseUrl, token };
console.log(`Target: ${PROJECT_REF} via ${databaseUrl ? 'DATABASE_URL' : 'SUPABASE_ACCESS_TOKEN'}`);

// Ensure migration tracker exists before applying
await runQuery(
  `CREATE TABLE IF NOT EXISTS _loyala_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  creds
);

for (const file of MIGRATIONS) {
  if (!(await applyFile(file, creds))) process.exit(1);
}

console.log('\n=== Post-apply schema probe (production via Railway) ===\n');
const probe = spawnSync(
  'npx',
  ['--yes', '@railway/cli', 'run', '--service', 'loyala-worker', 'node', join(__dirname, 'probe-schema-gaps.mjs')],
  { stdio: 'inherit', env: process.env, shell: true, cwd: join(__dirname, '..') }
);
process.exit(probe.status ?? 0);
