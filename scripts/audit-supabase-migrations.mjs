#!/usr/bin/env node
/**
 * Full Supabase migration audit.
 * Usage: node scripts/audit-supabase-migrations.mjs
 * Env: DATABASE_URL (or .env.ops.local) OR REST keys
 *
 * Tracks migrations 001→025 against `_loyala_migrations` and probes tables/RLS/RPC.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

function loadOpsEnv() {
  const path = join(root, '.env.ops.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) process.env[key] = v;
  }
}

loadOpsEnv();

/** Prefer filesystem list so new migrations are never forgotten. */
const MIGRATION_FILES = readdirSync(migrationsDir)
  .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
  .sort();

const EXPECTED_TABLES = [
  'organizations',
  'roles',
  'organization_members',
  'domain_events',
  'clients',
  'client_visits',
  'ai_request_logs',
  'campaigns',
  'campaign_sends',
  'loyalty_transactions',
  'reviews',
  'notifications',
  'whatsapp_messages',
  'conversation_sessions',
  'message_template_catalog',
  '_loyala_migrations',
];

const EXPECTED_RPC = [
  'get_tenant_ai_metrics',
  'complete_onboarding',
  'get_my_active_membership',
  'user_org_ids',
];

const TABLES_RLS = [
  'organizations',
  'organization_members',
  'roles',
  'domain_events',
  'clients',
  'client_visits',
  'ai_request_logs',
  'campaigns',
  'campaign_sends',
  'loyalty_transactions',
  'reviews',
  'notifications',
  'whatsapp_messages',
  'conversation_sessions',
  'message_template_catalog',
];

const INDEXES_012 = [
  'idx_campaigns_org_created',
  'idx_campaign_sends_org_created',
  'idx_campaign_sends_client',
  'idx_loyalty_tx_org',
  'idx_reviews_org',
];

const CRITICAL_MIGRATIONS = [
  '020_production_full_schema_alignment.sql',
  '021_client_visits.sql',
  '022_whatsapp_messages.sql',
  '023_conversation_sessions.sql',
  '024_message_template_catalog.sql',
  '025_p0_security_fixes.sql',
];

async function auditViaPg(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const report = { method: 'DATABASE_URL', migrations: {}, tables: {}, rpc: {}, rls: {}, indexes: {}, storage: {} };

  const { rows: applied } = await client.query(
    `SELECT name FROM _loyala_migrations ORDER BY name`
  ).catch(() => ({ rows: [] }));
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const file of MIGRATION_FILES) {
    report.migrations[file] = appliedSet.has(file) ? 'applied' : 'unknown_or_missing_tracker';
  }

  report.migrationsCritical = {};
  for (const file of CRITICAL_MIGRATIONS) {
    report.migrationsCritical[file] = appliedSet.has(file)
      ? 'applied'
      : 'missing_from_tracker';
  }

  // public.user_org_ids used by RLS (014+)
  {
    const { rows } = await client.query(
      `SELECT n.nspname AS schema
         FROM pg_proc p
         JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'user_org_ids'`
    );
    report.rpc.user_org_ids_schemas = rows.map((r) => r.schema);
    report.rpc.user_org_ids = rows.some((r) => r.schema === 'public') ? 'ok' : 'missing';
  }

  for (const table of EXPECTED_TABLES) {
    if (table === '_loyala_migrations') continue;
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    report.tables[table] = rows.length > 0 ? 'ok' : 'missing';
  }

  for (const fn of EXPECTED_RPC) {
    const { rows } = await client.query(
      `SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn]
    );
    report.rpc[fn] = rows.length > 0 ? 'ok' : 'missing';
  }

  for (const table of TABLES_RLS) {
    const { rows } = await client.query(
      `SELECT c.relrowsecurity AS rls_enabled
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [table]
    );
    report.rls[table] = rows[0]?.rls_enabled ? 'enabled' : 'disabled_or_missing';
  }

  for (const idx of INDEXES_012) {
    const { rows } = await client.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
      [idx]
    );
    report.indexes[idx] = rows.length > 0 ? 'ok' : 'missing';
  }

  const { rows: buckets } = await client.query(`SELECT id FROM storage.buckets WHERE id = 'org-assets'`);
  report.storage.org_assets_bucket = buckets.length > 0 ? 'ok' : 'missing';

  await client.end();
  return report;
}

async function auditViaRest(base, key) {
  const report = {
    method: 'SUPABASE_REST',
    migrations: {},
    migrationsCritical: {},
    tables: {},
    rpc: {},
    rls: {},
    indexes: {},
    storage: {},
  };

  for (const file of MIGRATION_FILES) {
    report.migrations[file] = 'unknown_via_rest';
  }
  for (const file of CRITICAL_MIGRATIONS) {
    report.migrationsCritical[file] = 'unknown_via_rest';
  }

  for (const table of EXPECTED_TABLES) {
    if (table === '_loyala_migrations') {
      report.tables[table] = 'unknown_via_rest';
      continue;
    }
    const res = await fetch(`${base}/rest/v1/${table}?select=id&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    });
    if (res.status === 404) {
      const text = await res.text();
      report.tables[table] = text.includes('does not exist') || text.includes('not found') ? 'missing' : `error_${res.status}`;
    } else if (res.ok || res.status === 200 || res.status === 206) {
      report.tables[table] = 'ok';
    } else {
      report.tables[table] = `error_${res.status}`;
    }
  }

  const dummyOrg = '00000000-0000-0000-0000-000000000001';
  for (const fn of EXPECTED_RPC) {
    const body =
      fn === 'get_tenant_ai_metrics'
        ? { p_organization_id: dummyOrg, p_since: new Date().toISOString() }
        : fn === 'complete_onboarding'
          ? { p_organization_name: 'audit-probe' }
          : {};
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (text.includes('Could not find the function') || text.includes('does not exist')) {
      report.rpc[fn] = 'missing';
    } else if (
      res.ok ||
      text.includes('forbidden') ||
      text.includes('access denied') ||
      (fn === 'complete_onboarding' && text.includes('not_authenticated'))
    ) {
      report.rpc[fn] = 'ok';
    } else {
      report.rpc[fn] = `error_${res.status}`;
    }
  }

  for (const table of TABLES_RLS) {
    report.rls[table] = 'unknown_via_rest';
  }
  for (const idx of INDEXES_012) {
    report.indexes[idx] = 'unknown_via_rest';
  }

  const bucketRes = await fetch(`${base}/storage/v1/bucket`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (bucketRes.ok) {
    const buckets = await bucketRes.json();
    const found =
      Array.isArray(buckets) &&
      buckets.some((b) => b?.id === 'org-assets' || b?.name === 'org-assets');
    report.storage.org_assets_bucket = found ? 'ok' : 'unknown_via_rest';
  } else {
    report.storage.org_assets_bucket = 'unknown_via_rest';
  }

  return report;
}

function summarize(report) {
  const missingTables = Object.entries(report.tables).filter(([, v]) => v === 'missing').map(([k]) => k);
  const missingRpc = Object.entries(report.rpc)
    .filter(([k, v]) => k !== 'user_org_ids_schemas' && v === 'missing')
    .map(([k]) => k);
  const missingIndexes = Object.entries(report.indexes).filter(([, v]) => v === 'missing').map(([k]) => k);
  const rlsIssues = Object.entries(report.rls).filter(([, v]) => v !== 'enabled' && v !== 'unknown_via_rest');
  const storageMissing = report.storage.org_assets_bucket === 'missing';
  const missingCritical = Object.entries(report.migrationsCritical ?? {})
    .filter(([, v]) => v !== 'applied')
    .map(([k]) => k);
  const missingMigrations = Object.entries(report.migrations)
    .filter(([, v]) => v !== 'applied' && v !== 'unknown_via_rest')
    .map(([k]) => k);

  return {
    ok:
      missingTables.length === 0 &&
      missingRpc.length === 0 &&
      missingIndexes.length === 0 &&
      rlsIssues.length === 0 &&
      (report.storage.org_assets_bucket === 'ok' ||
        report.storage.org_assets_bucket === 'unknown_via_rest'),
    // Tracker gaps are reported separately — many early migrations ran before tracker existed.
    trackerHealthy: missingCritical.length === 0,
    migrationFilesOnDisk: MIGRATION_FILES.length,
    missingMigrations,
    missingCritical,
    missingTables,
    missingRpc,
    missingIndexes,
    rlsIssues: rlsIssues.map(([t, v]) => `${t}:${v}`),
    storageMissing,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let report;
  if (databaseUrl) {
    report = await auditViaPg(databaseUrl);
  } else if (base && key) {
    report = await auditViaRest(base, key);
  } else {
    console.error('Set DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const summary = summarize(report);
  console.log(JSON.stringify({ summary, report }, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
