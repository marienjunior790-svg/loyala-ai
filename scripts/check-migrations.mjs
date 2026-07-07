#!/usr/bin/env node
/**
 * Check Supabase migrations 012/013 tables and storage bucket.
 * Requires DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 *
 * Usage: node scripts/check-migrations.mjs
 */
import pg from 'pg';

const tables012 = [
  'campaigns',
  'campaign_sends',
  'loyalty_transactions',
  'reviews',
  'notifications',
];

async function checkViaPg() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const missing = [];
  for (const table of tables012) {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (rows.length === 0) missing.push(table);
  }

  const { rows: buckets } = await client.query(
    `SELECT id FROM storage.buckets WHERE id = 'org-assets'`
  );
  await client.end();

  return {
    method: 'DATABASE_URL',
    tables012: missing.length === 0 ? 'ok' : 'missing',
    missingTables: missing,
    storage013: buckets.length > 0 ? 'ok' : 'missing',
  };
}

async function checkViaRest() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;

  const missing = [];
  for (const table of tables012) {
    const res = await fetch(`${base}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.status === 404 || (await res.text()).includes('does not exist')) {
      missing.push(table);
    }
  }

  const bucketRes = await fetch(`${base}/storage/v1/bucket/org-assets`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  return {
    method: 'SUPABASE_REST',
    tables012: missing.length === 0 ? 'ok' : 'missing',
    missingTables: missing,
    storage013: bucketRes.ok ? 'ok' : 'missing',
  };
}

async function main() {
  const result = (await checkViaPg()) ?? (await checkViaRest());
  if (!result) {
    console.error(
      'Set DATABASE_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) to check migrations.'
    );
    process.exit(2);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.missingTables.length > 0 || result.storage013 === 'missing' ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
