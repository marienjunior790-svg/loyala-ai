#!/usr/bin/env node
/**
 * Apply migration 014 via Supabase Management API (needs SUPABASE_ACCESS_TOKEN).
 * Token: https://supabase.com/dashboard/account/tokens
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-repair-via-api.mjs
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'nimjmyiggqgvledgwffv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function applyViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;
  const sql = await readFile(
    join(__dirname, '..', 'supabase', 'migrations', '014_repair_go_live_gaps.sql'),
    'utf8'
  );
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS _loyala_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query('SELECT 1 FROM _loyala_migrations WHERE name = $1', [
    '014_repair_go_live_gaps.sql',
  ]);
  if (rows.length > 0) {
    console.log('skip 014 (already in _loyala_migrations)');
    await client.end();
    return true;
  }
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _loyala_migrations (name) VALUES ($1)', [
      '014_repair_go_live_gaps.sql',
    ]);
    await client.query('COMMIT');
    console.log('ok 014 via DATABASE_URL');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  await client.end();
  return true;
}

async function applyViaManagementApi() {
  if (!token) return false;
  const sql = await readFile(
    join(__dirname, '..', 'supabase', 'migrations', '014_repair_go_live_gaps.sql'),
    'utf8'
  );
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error('Management API failed:', res.status, body.slice(0, 500));
    return false;
  }
  console.log('ok 014 via Supabase Management API');
  return true;
}

async function main() {
  if (await applyViaPg()) return;
  if (await applyViaManagementApi()) return;
  console.error(
    'Cannot apply SQL repair. Set one of:\n' +
      '  DATABASE_URL=postgresql://...\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_... (from supabase.com/dashboard/account/tokens)'
  );
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
