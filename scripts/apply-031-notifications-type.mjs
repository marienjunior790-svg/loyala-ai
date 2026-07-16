#!/usr/bin/env node
/** Apply migration 031: fix stale notifications_type_check constraint. */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const MIGRATION = '031_fix_notifications_type_check.sql';

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
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const before = await client.query(
  `SELECT type, count(*) FROM public.notifications GROUP BY type ORDER BY count(*) DESC;`
);
console.log('Existing notifications.type values:');
for (const r of before.rows) console.log(`  ${r.type}: ${r.count}`);

const sql = readFileSync(join(root, 'supabase', 'migrations', MIGRATION), 'utf8');
console.log(`\nApplying ${MIGRATION}…`);
await client.query(sql);

const check = await client.query(`
  SELECT pg_get_constraintdef(con.oid) AS def
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname='public' AND rel.relname='notifications'
    AND con.conname='notifications_type_check';
`);
console.log('New notifications_type_check:', check.rows[0]?.def ?? '(missing!)');

await client.end();
console.log('Done.');
