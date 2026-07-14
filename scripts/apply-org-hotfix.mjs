#!/usr/bin/env node
/** Apply org hotfix — tries direct DB URL then Supabase poolers (IPv4). Never logs secrets. */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROJECT_REF = 'nimjmyiggqgvledgwffv';

function loadOpsEnv() {
  const path = join(root, '.env.ops.local');
  if (!existsSync(path)) throw new Error('Missing .env.ops.local');
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

function extractPassword(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return decodeURIComponent(u.password || '');
  } catch {
    return '';
  }
}

function candidates(databaseUrl) {
  const password = extractPassword(databaseUrl);
  const encoded = encodeURIComponent(password);
  const list = [databaseUrl];
  if (!password) return list;

  const regions = ['eu-west-1', 'eu-central-1', 'us-east-1'];
  for (const region of regions) {
    // Session pooler (port 5432)
    list.push(
      `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`
    );
    // Transaction pooler (port 6543)
    list.push(
      `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    );
  }
  return list;
}

const env = loadOpsEnv();
const databaseUrl = env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes('[PASSWORD]')) {
  console.error('DATABASE_URL missing');
  process.exit(2);
}

const sql = readFileSync(
  join(root, 'scripts/sql/hotfix-organizations-plan-status.sql'),
  'utf8'
);

const urls = candidates(databaseUrl);
let lastError = null;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const label =
    i === 0
      ? 'direct'
      : url.includes(':6543/')
        ? `pooler-tx-${url.includes('eu-west') ? 'eu-west-1' : url.includes('eu-central') ? 'eu-central-1' : 'us-east-1'}`
        : `pooler-session-${url.includes('eu-west') ? 'eu-west-1' : url.includes('eu-central') ? 'eu-central-1' : 'us-east-1'}`;

  process.stdout.write(`Trying ${label} … `);
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });

  try {
    await client.connect();
    await client.query(sql);
    const check = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organizations'
        AND column_name IN ('plan_status', 'deleted_at', 'settings', 'country_code')
      ORDER BY column_name
    `);
    console.log('OK');
    console.log(
      'columns:',
      check.rows.map((r) => r.column_name).join(', ')
    );
    await client.end();
    process.exit(0);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.log('fail');
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

console.error('All connection attempts failed.');
console.error('Last error:', lastError);
process.exit(1);
