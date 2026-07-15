#!/usr/bin/env node
/** Apply migration 027 with pooler fallbacks + verify FK / tenant sync. */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const MIGRATION = '027_fix_members_roles_and_campaigns_tenant.sql';

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
    return decodeURIComponent(new URL(databaseUrl).password || '');
  } catch {
    return '';
  }
}

function candidates(databaseUrl) {
  const password = extractPassword(databaseUrl);
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
if (!databaseUrl || databaseUrl.includes('[PASSWORD]')) {
  console.error('DATABASE_URL missing in .env.ops.local');
  process.exit(2);
}

const sql = readFileSync(join(root, 'supabase/migrations', MIGRATION), 'utf8');
const urls = candidates(databaseUrl);
let lastError = null;

for (let i = 0; i < urls.length; i++) {
  const label = i === 0 ? 'direct' : `pooler-${i}`;
  process.stdout.write(`Applying 027 via ${label} … `);
  const client = new pg.Client({
    connectionString: urls[i],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });

  try {
    await client.connect();
    await client.query(sql);

    const fk = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'organization_members'
        AND constraint_name = 'organization_members_role_id_fkey'
    `);

    const tenantCol = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'tenant_id'
    `);

    const mig = await client.query(`
      SELECT name FROM _loyala_migrations WHERE name = $1
    `, [MIGRATION]);

    console.log('OK');
    console.log('FK organization_members→roles:', fk.rows.length > 0 ? 'present' : 'MISSING');
    console.log('campaigns.tenant_id column:', tenantCol.rows.length > 0 ? 'present (synced)' : 'absent (ok)');
    console.log('migration tracker:', mig.rows.length > 0 ? 'recorded' : 'not recorded');
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
