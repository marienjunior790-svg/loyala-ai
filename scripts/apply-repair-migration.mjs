#!/usr/bin/env node
/**
 * Apply migration 014 (repair gaps) via DATABASE_URL.
 * Usage: DATABASE_URL=postgresql://... node scripts/apply-repair-migration.mjs
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION = '014_repair_go_live_gaps.sql';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'Missing DATABASE_URL.\n' +
        'Supabase → Project Settings → Database → Connection string (URI)\n' +
        'Example: postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres'
    );
    process.exit(2);
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
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
    return;
  }

  const sql = await readFile(join(__dirname, '..', 'supabase', 'migrations', MIGRATION), 'utf8');
  console.log(`apply ${MIGRATION}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _loyala_migrations (name) VALUES ($1)', [MIGRATION]);
    await client.query('COMMIT');
    console.log(`ok ${MIGRATION}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('fail:', error.message);
    process.exit(1);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
