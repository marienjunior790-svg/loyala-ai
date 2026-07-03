#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql in order via DATABASE_URL.
 * Usage: DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'Missing DATABASE_URL.\n' +
        'Set postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres'
    );
    process.exit(1);
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

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _loyala_migrations WHERE name = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _loyala_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`ok  ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`fail ${file}:`, error.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
