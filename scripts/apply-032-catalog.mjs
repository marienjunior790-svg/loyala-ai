#!/usr/bin/env node
/** Apply migration 032: catalog & sales tables. */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const MIGRATION = '032_catalog_and_sales.sql';

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

const env = loadOpsEnv();
const sql = readFileSync(join(root, 'supabase', 'migrations', MIGRATION), 'utf8');

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
console.log(`Applying ${MIGRATION}…`);
await client.query(sql);

const tables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('catalog_categories','catalog_items','visit_items')
  ORDER BY table_name;
`);
console.log('Tables present:', tables.rows.map((r) => r.table_name).join(', '));

await client.end();
console.log('Done.');
