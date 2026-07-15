#!/usr/bin/env node
/** Backfill _loyala_migrations for schema objects that exist but lack tracker rows. */
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

function loadOps() {
  const env = {};
  if (!existsSync('.env.ops.local')) throw new Error('Missing .env.ops.local');
  for (const line of readFileSync('.env.ops.local', 'utf8').split(/\r?\n/)) {
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

const CHECKS = [
  { file: '021_client_visits.sql', table: 'client_visits' },
  { file: '022_whatsapp_messages.sql', table: 'whatsapp_messages' },
  { file: '023_conversation_sessions.sql', table: 'conversation_sessions' },
  { file: '024_message_template_catalog.sql', table: 'message_template_catalog' },
  { file: '025_p0_security_fixes.sql', table: null },
];

const env = loadOps();
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _loyala_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const check of CHECKS) {
    if (check.table) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [check.table]
      );
      if (!rowCount) {
        console.log(`⏭ ${check.file} — table ${check.table} missing, skip tracker`);
        continue;
      }
    }
    const { rowCount } = await client.query(
      `INSERT INTO _loyala_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [check.file]
    );
    console.log(
      rowCount
        ? `✅ ${check.file} — tracker inserted`
        : `· ${check.file} — already tracked`
    );
  }
} finally {
  await client.end();
}
