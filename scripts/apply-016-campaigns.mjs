#!/usr/bin/env node
/**
 * Apply migration 016 via DATABASE_URL or SUPABASE_ACCESS_TOKEN.
 * Never logs secret values.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'nimjmyiggqgvledgwffv';
const MIGRATION = '016_repair_campaigns_crud.sql';
const sql = await readFile(join(__dirname, '..', 'supabase', 'migrations', MIGRATION), 'utf8');

async function applyPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS _loyala_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query('SELECT 1 FROM _loyala_migrations WHERE name = $1', [MIGRATION]);
  if (rows.length > 0) {
    console.log(`skip ${MIGRATION} (already applied)`);
    await client.end();
    return true;
  }
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _loyala_migrations (name) VALUES ($1)', [MIGRATION]);
    await client.query('COMMIT');
    console.log(`ok ${MIGRATION} via DATABASE_URL`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  await client.end();
  return true;
}

async function applyApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
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
    console.error('Management API failed:', res.status, body.slice(0, 400));
    return false;
  }
  console.log(`ok ${MIGRATION} via Management API`);
  return true;
}

if (await applyPg()) process.exit(0);
if (await applyApi()) process.exit(0);
console.error('Need DATABASE_URL or SUPABASE_ACCESS_TOKEN to apply', MIGRATION);
process.exit(2);
