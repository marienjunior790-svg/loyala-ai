#!/usr/bin/env node
/** List message_template_catalog rows. Reads .env.ops.local */
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

function loadOps() {
  if (!existsSync('.env.ops.local')) throw new Error('Missing .env.ops.local');
  const env = {};
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
  const r = await client.query(
    `SELECT provider_template_name, status, approved_at
       FROM message_template_catalog
      WHERE channel = 'whatsapp' AND organization_id IS NULL
      ORDER BY provider_template_name`
  );
  console.log(JSON.stringify(r.rows, null, 2));
} finally {
  await client.end();
}
