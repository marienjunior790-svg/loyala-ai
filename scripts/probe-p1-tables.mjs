#!/usr/bin/env node
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

const env = loadOps();
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const tables = [
    'client_visits',
    'whatsapp_messages',
    'conversation_sessions',
    'message_template_catalog',
  ];
  for (const table of tables) {
    const r = await client.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    console.log(`${table}: ${r.rowCount ? 'EXISTS' : 'MISSING'}`);
  }
  const m = await client.query(`SELECT name FROM _loyala_migrations ORDER BY name`);
  console.log('tracker:', m.rows.map((x) => x.name).join(', ') || '(empty)');
} finally {
  await client.end();
}
