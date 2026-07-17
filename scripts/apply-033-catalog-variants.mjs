#!/usr/bin/env node
/** Apply migration 033: catalog variants metadata (GIN index, retrocompatible). */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const MIGRATION = '033_catalog_variants_metadata.sql';

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
if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing in .env.ops.local');

const sql = readFileSync(join(root, 'supabase', 'migrations', MIGRATION), 'utf8');
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
console.log(`Applying ${MIGRATION}…`);
await client.query(sql);

const check = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_catalog_items_metadata_gin') AS gin_index,
    (SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'catalog_items'
         AND column_name = 'metadata') AS metadata_nullable,
    (SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'catalog_items'
         AND column_name = 'metadata') AS metadata_default
`);
const row = check.rows[0];
console.log('Verification:', {
  gin_index: row.gin_index === 1 ? 'OK' : 'MISSING',
  metadata_nullable: row.metadata_nullable,
  metadata_default: row.metadata_default,
});

await client.end();
console.log('Done.');
