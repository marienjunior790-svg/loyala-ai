#!/usr/bin/env node
/**
 * Verify migration 022_whatsapp_messages.sql against production/staging Supabase.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/verify-022-whatsapp-messages.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/verify-022-whatsapp-messages.mjs
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-022-whatsapp-messages.mjs
 *
 * Never logs secret values.
 */
import pg from 'pg';

const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const TABLE = 'whatsapp_messages';

const EXPECTED_COLUMNS = [
  'id',
  'organization_id',
  'client_id',
  'campaign_send_id',
  'wamid',
  'phone',
  'template_name',
  'message_body',
  'status',
  'sent_at',
  'delivered_at',
  'read_at',
  'error_message',
  'raw_payload',
  'created_at',
  'updated_at',
];

const EXPECTED_INDEXES = [
  'idx_whatsapp_messages_org_created',
  'idx_whatsapp_messages_campaign_send',
  'idx_whatsapp_messages_client',
  'idx_whatsapp_messages_status',
];

const EXPECTED_POLICIES = [
  { name: 'whatsapp_messages_select', cmd: 'SELECT' },
  { name: 'whatsapp_messages_insert', cmd: 'INSERT' },
  { name: 'whatsapp_messages_update', cmd: 'UPDATE' },
  { name: 'whatsapp_messages_delete', cmd: 'DELETE' },
];

const EXPECTED_FKS = [
  { column: 'organization_id', refTable: 'organizations', deleteRule: 'CASCADE' },
  { column: 'client_id', refTable: 'clients', deleteRule: 'SET NULL' },
  { column: 'campaign_send_id', refTable: 'campaign_sends', deleteRule: 'SET NULL' },
];

const EXPECTED_TRIGGER = 'whatsapp_messages_updated_at';
const EXPECTED_STATUS_VALUES = ['queued', 'sent', 'delivered', 'read', 'failed'];

let failures = 0;
let partialAudit = false;

function pass(label, detail = '') {
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  failures += 1;
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

async function createQueryRunner() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    return {
      method: 'DATABASE_URL',
      async query(sql, params = []) {
        return client.query(sql, params);
      },
      async close() {
        await client.end();
      },
    };
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) {
    return {
      method: 'SUPABASE_ACCESS_TOKEN',
      async query(sql) {
        const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: sql }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
        const data = text ? JSON.parse(text) : [];
        return { rows: Array.isArray(data) ? data : data?.result ?? [] };
      },
      async close() {},
    };
  }

  return null;
}

async function auditViaSql(runner) {
  section('Table');
  const { rows: tableRows } = await runner.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${TABLE}'`
  );
  if (tableRows.length > 0) pass('table', TABLE);
  else {
    fail('table', `${TABLE} absente`);
    return false;
  }

  section('Columns');
  const { rows: columns } = await runner.query(
    `SELECT column_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${TABLE}'
     ORDER BY ordinal_position`
  );
  const colNames = new Set(columns.map((c) => c.column_name));
  for (const name of EXPECTED_COLUMNS) {
    if (colNames.has(name)) pass('column', name);
    else fail('column', `manquante: ${name}`);
  }

  section('Index');
  const { rows: indexes } = await runner.query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = '${TABLE}'`
  );
  const indexNames = new Set(indexes.map((i) => i.indexname));
  for (const idx of EXPECTED_INDEXES) {
    if (indexNames.has(idx)) pass('index', idx);
    else fail('index', `manquant: ${idx}`);
  }
  const hasWamidUnique = indexes.some(
    (i) => i.indexdef.includes('wamid') && i.indexdef.toLowerCase().includes('unique')
  );
  if (hasWamidUnique) pass('index', 'wamid UNIQUE');
  else fail('index', 'contrainte UNIQUE sur wamid manquante');
  if (indexNames.has(`${TABLE}_pkey`)) pass('index', `${TABLE}_pkey`);
  else fail('index', 'clé primaire manquante');

  section('Policies');
  const { rows: rlsRow } = await runner.query(
    `SELECT c.relrowsecurity AS enabled
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = '${TABLE}'`
  );
  if (rlsRow[0]?.enabled) pass('policies', 'RLS enabled');
  else fail('policies', 'RLS désactivé');

  const { rows: policies } = await runner.query(
    `SELECT policyname, cmd FROM pg_policies
     WHERE schemaname = 'public' AND tablename = '${TABLE}'`
  );
  for (const expected of EXPECTED_POLICIES) {
    const found = policies.find((p) => p.policyname === expected.name && p.cmd === expected.cmd);
    if (found) pass('policy', `${expected.name} (${expected.cmd})`);
    else fail('policy', `manquante: ${expected.name} ${expected.cmd}`);
  }

  section('Triggers');
  const { rows: triggers } = await runner.query(
    `SELECT tgname, pg_get_triggerdef(t.oid) AS def
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = '${TABLE}' AND NOT t.tgisinternal`
  );
  const trigger = triggers.find((t) => t.tgname === EXPECTED_TRIGGER);
  if (trigger) {
    pass('trigger', EXPECTED_TRIGGER);
    if (String(trigger.def).includes('set_updated_at')) pass('trigger function', 'set_updated_at()');
    else fail('trigger function', 'set_updated_at() non référencé');
  } else {
    fail('trigger', `manquant: ${EXPECTED_TRIGGER}`);
  }

  section('Contraintes');
  const { rows: fks } = await runner.query(
    `SELECT
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
     WHERE tc.table_schema = 'public' AND tc.table_name = '${TABLE}' AND tc.constraint_type = 'FOREIGN KEY'`
  );
  for (const expected of EXPECTED_FKS) {
    const fk = fks.find(
      (f) => f.column_name === expected.column && f.foreign_table_name === expected.refTable
    );
    if (!fk) {
      fail('FK', `${expected.column} → ${expected.refTable}`);
      continue;
    }
    if (fk.delete_rule === expected.deleteRule) {
      pass('FK', `${expected.column} → ${expected.refTable} ON DELETE ${fk.delete_rule}`);
    } else {
      fail('FK', `${expected.column} delete rule attendu ${expected.deleteRule}, reçu ${fk.delete_rule}`);
    }
  }

  const { rows: checks } = await runner.query(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public' AND rel.relname = '${TABLE}' AND con.contype = 'c'`
  );
  const statusCheck = checks.find((c) => String(c.def).includes('status'));
  if (statusCheck) {
    const missing = EXPECTED_STATUS_VALUES.filter((v) => !String(statusCheck.def).includes(`'${v}'`));
    if (missing.length === 0) pass('CHECK', 'status IN (queued, sent, delivered, read, failed)');
    else fail('CHECK', `status values manquantes: ${missing.join(', ')}`);
  } else {
    fail('CHECK', 'contrainte status manquante');
  }

  const { rows: grants } = await runner.query(
    `SELECT grantee, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = '${TABLE}'`
  );
  const authGrants = new Set(
    grants.filter((g) => g.grantee === 'authenticated').map((g) => g.privilege_type)
  );
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    if (authGrants.has(priv)) pass('GRANT', `authenticated ${priv}`);
    else fail('GRANT', `authenticated ${priv} manquant`);
  }
  if (grants.some((g) => g.grantee === 'service_role')) pass('GRANT', 'service_role');
  else fail('GRANT', 'service_role manquant');

  return true;
}

async function auditViaRest(base, key) {
  partialAudit = true;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  section('Table');
  const tableRes = await fetch(`${base}/rest/v1/${TABLE}?select=id&limit=0`, { headers });
  if (tableRes.status === 200) pass('table', `${TABLE} accessible via REST`);
  else {
    fail('table', `HTTP ${tableRes.status} — migration 022 probablement non appliquée`);
    return;
  }

  section('Columns (REST)');
  for (const col of EXPECTED_COLUMNS) {
    const res = await fetch(`${base}/rest/v1/${TABLE}?select=${encodeURIComponent(col)}&limit=0`, {
      headers,
    });
    const text = await res.text();
    const missing =
      !res.ok &&
      (text.includes('does not exist') ||
        text.includes('Could not find') ||
        (text.includes('column') && text.includes('not found')));
    if (res.ok) pass('column', col);
    else if (missing) fail('column', `manquante: ${col}`);
    else fail('column', `${col} — HTTP ${res.status}`);
  }

  section('Index / Policies / Triggers / Contraintes');
  console.log('⚠️  Audit partiel — index, policies, triggers et FK nécessitent DATABASE_URL ou SUPABASE_ACCESS_TOKEN.');
}

async function main() {
  console.log('Migration 022 — audit whatsapp_messages\n');

  const runner = await createQueryRunner();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (runner) {
    console.log(`Méthode: ${runner.method}`);
    try {
      await auditViaSql(runner);
    } finally {
      await runner.close();
    }
  } else if (base && key) {
    console.log('Méthode: SUPABASE_REST (partiel)');
    await auditViaRest(base, key);
  } else {
    console.error('❌ Need DATABASE_URL, SUPABASE_ACCESS_TOKEN, or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(2);
  }

  section('Résumé');
  if (partialAudit && failures === 0) {
    console.log('⚠️  Table + colonnes OK — relancer avec DATABASE_URL ou SUPABASE_ACCESS_TOKEN pour audit complet.');
    process.exit(0);
  }
  if (failures === 0) {
    console.log('✅ Tous les contrôles passés — migration 022 alignée.');
    process.exit(0);
  }
  console.log(`❌ ${failures} élément(s) manquant(s) ou incorrect(s).`);
  console.log('   Appliquer: node scripts/apply-migration-file.mjs 022_whatsapp_messages.sql');
  process.exit(1);
}

main().catch((error) => {
  console.error('❌ Erreur audit:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
