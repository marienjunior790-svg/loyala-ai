#!/usr/bin/env node
/**
 * Verify migration 023_conversation_sessions.sql
 * Usage: DATABASE_URL=... node scripts/verify-023-conversation-sessions.mjs
 */
import pg from 'pg';

const TABLE = 'conversation_sessions';
const EXPECTED_INDEXES = [
  'idx_conversation_sessions_org_client',
  'idx_conversation_sessions_external',
  'idx_conversation_sessions_inbound',
];

let failures = 0;
function pass(label, detail = '') {
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail = '') {
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
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

  console.log('Migration 023 — audit conversation_sessions\n');

  const { rows: tableRows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [TABLE]
  );
  if (tableRows.length > 0) pass('table', TABLE);
  else fail('table', `${TABLE} absente`);

  if (tableRows.length > 0) {
    const { rows: indexes } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
      [TABLE]
    );
    const names = new Set(indexes.map((i) => i.indexname));
    for (const idx of EXPECTED_INDEXES) {
      if (names.has(idx)) pass('index', idx);
      else fail('index', `manquant: ${idx}`);
    }

    const { rows: rls } = await client.query(
      `SELECT c.relrowsecurity AS enabled FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [TABLE]
    );
    if (rls[0]?.enabled) pass('policies', 'RLS enabled');
    else fail('policies', 'RLS désactivé');

    const { rows: unique } = await client.query(
      `SELECT 1 FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = $1 AND con.contype = 'u'`,
      [TABLE]
    );
    if (unique.length > 0) pass('constraint', 'UNIQUE (organization_id, client_id, channel)');
    else fail('constraint', 'unique tenant session manquante');
  }

  await client.end();

  if (failures === 0) {
    console.log('\n✅ Migration 023 alignée.');
    process.exit(0);
  }
  console.log(`\n❌ ${failures} élément(s) manquant(s).`);
  console.log('   Appliquer: node scripts/apply-migration-file.mjs 023_conversation_sessions.sql');
  process.exit(1);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
