#!/usr/bin/env node
/** Verify migration 024_message_template_catalog.sql */
import pg from 'pg';

const TABLE = 'message_template_catalog';
const PLATFORM_TEMPLATES = [
  'loyala_birthday_v1',
  'loyala_inactive_v1',
  'loyala_loyalty_v1',
  'loyala_promo_v1',
];

let failures = 0;
function pass(l, d = '') {
  console.log(`✅ ${l}${d ? ` — ${d}` : ''}`);
}
function fail(l, d = '') {
  console.log(`❌ ${l}${d ? ` — ${d}` : ''}`);
  failures += 1;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Need DATABASE_URL');
    process.exit(2);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Migration 024 — audit message_template_catalog\n');

  const { rows: tables } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [TABLE]
  );
  if (tables.length) pass('table', TABLE);
  else {
    fail('table', TABLE);
    await client.end();
    process.exit(1);
  }

  const { rows: seeds } = await client.query(
    `SELECT provider_template_name, status FROM message_template_catalog
     WHERE organization_id IS NULL AND channel = 'whatsapp'`
  );
  for (const name of PLATFORM_TEMPLATES) {
    const row = seeds.find((s) => s.provider_template_name === name);
    if (row) pass('seed', `${name} (${row.status})`);
    else fail('seed', `manquant: ${name}`);
  }

  const { rows: rls } = await client.query(
    `SELECT c.relrowsecurity AS enabled FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [TABLE]
  );
  if (rls[0]?.enabled) pass('policies', 'RLS enabled');
  else fail('policies', 'RLS désactivé');

  await client.end();

  if (failures === 0) {
    console.log('\n✅ Migration 024 alignée.');
    process.exit(0);
  }
  console.log(`\n❌ ${failures} gap(s). Apply: node scripts/apply-migration-file.mjs 024_message_template_catalog.sql`);
  process.exit(1);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
