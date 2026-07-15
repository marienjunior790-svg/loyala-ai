#!/usr/bin/env node
/**
 * WhatsApp production pilot send.
 * Reads .env.ops.local (DATABASE_URL, WHATSAPP_TEST_CLIENT_ID) and
 * .env.worker-secret.local (WORKER_API_SECRET), resolves the test client's
 * phone + org from the DB, then calls the worker /whatsapp/send-test.
 *
 * Uses the always-available Meta "hello_world" template so the pilot works
 * before loyala_* templates are approved.
 */
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://loyala-worker-production.up.railway.app';

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
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

const ops = loadEnvFile('.env.ops.local');
const workerSecret = loadEnvFile('.env.worker-secret.local').WORKER_API_SECRET;

if (!ops.DATABASE_URL) throw new Error('Missing DATABASE_URL in .env.ops.local');
if (!workerSecret)
  throw new Error('Missing WORKER_API_SECRET in .env.worker-secret.local');

const clientId = ops.WHATSAPP_TEST_CLIENT_ID;
const client = new pg.Client({
  connectionString: ops.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
let row;
try {
  const res = await client.query(
    `SELECT id, organization_id, phone FROM clients WHERE id = $1`,
    [clientId]
  );
  row = res.rows[0];
} finally {
  await client.end();
}

if (!row) throw new Error(`Test client not found: ${clientId}`);
if (!row.phone) throw new Error('Test client has no phone');

const payload = {
  to: row.phone,
  type: 'template',
  templateName: process.env.TEMPLATE_NAME ?? 'hello_world',
  templateLanguage: process.env.TEMPLATE_LANG ?? 'en_US',
  organizationId: row.organization_id,
  clientId: row.id,
};

console.log(
  `Sending pilot template "${payload.templateName}" (${payload.templateLanguage}) to org ${row.organization_id} ...`
);

const resp = await fetch(`${WORKER_URL}/whatsapp/send-test`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${workerSecret}`,
  },
  body: JSON.stringify(payload),
});

const text = await resp.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

// Never print the raw phone number.
if (json && typeof json === 'object' && 'phone' in json) {
  const p = String(json.phone ?? '');
  json.phone = p.length > 5 ? `${p.slice(0, 4)}***${p.slice(-2)}` : 'set';
}

console.log(`HTTP ${resp.status}`);
console.log(JSON.stringify(json, null, 2));

if (resp.status !== 200) process.exitCode = 1;
