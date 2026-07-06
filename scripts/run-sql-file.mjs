#!/usr/bin/env node
/**
 * Run a .sql file against DATABASE_URL (Supabase Postgres).
 * Usage: DATABASE_URL=postgresql://... node scripts/run-sql-file.mjs scripts/bloc1-clients-align.sql
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: DATABASE_URL=... node scripts/run-sql-file.mjs <path-to.sql>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL.');
  console.error('Supabase → Settings → Database → Connection string (URI)');
  process.exit(1);
}

const sql = await readFile(resolve(file), 'utf8');
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query(sql);
  console.log(`OK: ${file}`);
} finally {
  await client.end();
}
