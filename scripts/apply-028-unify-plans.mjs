#!/usr/bin/env node
/** Apply migration 028 with pooler fallbacks. */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const MIGRATION = '028_unify_billing_plans.sql';

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

function candidates(databaseUrl) {
  let password = '';
  try {
    password = decodeURIComponent(new URL(databaseUrl).password || '');
  } catch {
    /* ignore */
  }
  const encoded = encodeURIComponent(password);
  const list = [databaseUrl];
  if (!password) return list;
  for (const region of ['eu-west-1', 'eu-central-1', 'us-east-1']) {
    list.push(
      `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`
    );
    list.push(
      `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    );
  }
  return list;
}

const env = loadOpsEnv();
const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL missing');
  process.exit(2);
}

const sql = readFileSync(join(root, 'supabase/migrations', MIGRATION), 'utf8');
let lastError = null;
for (let i = 0; i < candidates(databaseUrl).length; i++) {
  const label = i === 0 ? 'direct' : `pooler-${i}`;
  process.stdout.write(`Applying 028 via ${label} … `);
  const client = new pg.Client({
    connectionString: candidates(databaseUrl)[i],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  try {
    await client.connect();
    await client.query(sql);
    const check = await client.query(`
      SELECT plan FROM organizations LIMIT 1
    `);
    console.log('OK sample plan=', check.rows[0]?.plan ?? '(no orgs)');
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
console.error(lastError);
process.exit(1);
