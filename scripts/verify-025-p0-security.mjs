#!/usr/bin/env node
/** Verify migration 025 policies in production DB. Reads .env.ops.local */
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
if (!env.DATABASE_URL) {
  console.error('❌ Need DATABASE_URL in .env.ops.local');
  process.exit(2);
}

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  const mig = await client.query(
    `SELECT 1 FROM _loyala_migrations WHERE name = '025_p0_security_fixes.sql'`
  );
  console.log(
    mig.rowCount ? '✅ Migration 025 tracked' : '⏳ Migration 025 not in tracker yet'
  );

  const aiPolicy = await client.query(
    `SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
       FROM pg_policy pol
       JOIN pg_class cls ON cls.oid = pol.polrelid
       JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'public'
        AND cls.relname = 'ai_request_logs'
        AND pol.polname = 'ai_logs_select'`
  );
  const aiExpr = aiPolicy.rows[0]?.using_expr ?? '';
  if (aiExpr.includes('user_org_ids()') && !aiExpr.includes('auth.user_org_ids()')) {
    console.log('✅ ai_request_logs uses user_org_ids() (public schema)');
  } else {
    console.log('❌ ai_request_logs policy:', aiExpr || 'missing');
  }

  const storagePolicies = await client.query(
    `SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
       FROM pg_policy pol
       JOIN pg_class cls ON cls.oid = pol.polrelid
       JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'storage'
        AND cls.relname = 'objects'
        AND pol.polname LIKE 'org_assets_%'
      ORDER BY pol.polname`
  );

  const expected = ['org_assets_delete', 'org_assets_insert', 'org_assets_read', 'org_assets_update'];
  const found = storagePolicies.rows.map((r) => r.polname);
  for (const name of expected) {
    const row = storagePolicies.rows.find((r) => r.polname === name);
    if (!row) {
      console.log(`❌ storage policy missing: ${name}`);
      continue;
    }
    const expr = `${row.using_expr ?? ''} ${row.check_expr ?? ''}`;
    if (
      expr.includes('user_org_ids()') &&
      !expr.includes('auth.user_org_ids()') &&
      expr.includes('foldername')
    ) {
      console.log(`✅ ${name} scoped by org folder`);
    } else {
      console.log(`❌ ${name} not scoped correctly:`, expr.slice(0, 120));
    }
  }

  if (found.includes('org_assets_write')) {
    console.log('❌ legacy org_assets_write policy still present');
  }
} finally {
  await client.end();
}
