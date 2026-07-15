#!/usr/bin/env node
/** List Loyala WhatsApp template status from Meta + DB. Reads .env.ops.local */
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
const token = env.WHATSAPP_ACCESS_TOKEN;
const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const version = env.WHATSAPP_API_VERSION || 'v21.0';
const names = [
  'loyala_birthday_v1',
  'loyala_inactive_v1',
  'loyala_loyalty_v1',
  'loyala_promo_v1',
];

if (!token || !wabaId) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID');
  process.exit(2);
}

const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates?fields=name,status,language,category,rejected_reason&limit=100`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});
const json = await res.json();

if (!res.ok) {
  console.log('META_ERROR', JSON.stringify(json?.error ?? json, null, 2));
  process.exit(1);
}

const rows = (json.data ?? []).filter((t) => names.includes(t.name));
const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

console.log('\n=== Meta template status ===');
for (const name of names) {
  const t = byName[name];
  if (!t) {
    console.log(`❓ ${name} — not found (not submitted yet)`);
  } else {
    const icon =
      t.status === 'APPROVED' ? '✅' : t.status === 'PENDING' ? '⏳' : '❌';
    console.log(
      `${icon} ${name} — ${t.status} (${t.language})${t.rejected_reason ? ` — ${t.rejected_reason}` : ''}`
    );
  }
}

if (env.DATABASE_URL) {
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const db = await client.query(
      `SELECT provider_template_name, status, approved_at
         FROM message_template_catalog
        WHERE channel = 'whatsapp'
          AND organization_id IS NULL
          AND provider_template_name = ANY($1::text[])
        ORDER BY provider_template_name`,
      [names]
    );
    console.log('\n=== DB catalog status ===');
    if (db.rows.length === 0) {
      console.log('❓ No rows — migration 024 may not be applied');
    } else {
      for (const r of db.rows) {
        const icon = r.status === 'approved' ? '✅' : '⏳';
        console.log(
          `${icon} ${r.provider_template_name} — ${r.status}${r.approved_at ? ` (since ${r.approved_at.toISOString().slice(0, 10)})` : ''}`
        );
      }
    }
  } finally {
    await client.end();
  }
}
