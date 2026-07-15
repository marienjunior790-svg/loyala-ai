#!/usr/bin/env node
/** Fetch test client phone + org for E2E send. Reads .env.ops.local. */
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
const clientId = env.WHATSAPP_TEST_CLIENT_ID;
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const res = await client.query(
    `SELECT id, organization_id, full_name, phone, opt_in_whatsapp
       FROM clients WHERE id = $1`,
    [clientId]
  );
  if (res.rows.length === 0) {
    console.log('CLIENT_NOT_FOUND', clientId);
  } else {
    const r = res.rows[0];
    // Mask phone middle digits for display
    const phone = String(r.phone ?? '');
    const masked =
      phone.length > 5
        ? `${phone.slice(0, 4)}***${phone.slice(-2)}`
        : 'set';
    console.log(
      JSON.stringify(
        {
          organization_id: r.organization_id,
          full_name: r.full_name,
          phone_present: Boolean(r.phone),
          phone_masked: masked,
          opt_in_whatsapp: r.opt_in_whatsapp,
        },
        null,
        2
      )
    );
  }
} finally {
  await client.end();
}
