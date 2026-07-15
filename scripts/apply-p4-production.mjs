#!/usr/bin/env node
/**
 * P4 — Apply all pending Supabase repairs and re-audit.
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/apply-p4-production.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-p4-production.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const MIGRATION = '014_repair_go_live_gaps.sql';

function runNode(script, env = process.env) {
  const r = spawnSync('node', [script], { stdio: 'inherit', env, shell: false });
  return r.status ?? 1;
}

async function applySql(sql) {
  const databaseUrl = process.env.DATABASE_URL;
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  const chunks = sql
    .split(/^-- ───/m)
    .map((c, i) => (i === 0 ? c : `-- ───${c}`))
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !c.startsWith('-- Loyala AI'));

  async function runQuery(query) {
    if (databaseUrl) {
      const { default: pg } = await import('pg');
      const client = new pg.Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      try {
        await client.query(query);
      } finally {
        await client.end();
      }
      return true;
    }
    if (token) {
      const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('Management API error:', res.status, text.slice(0, 600));
        return false;
      }
      return true;
    }
    return false;
  }

  if (!databaseUrl && !token) return false;

  console.log(`\n=== Applying ${MIGRATION} in ${chunks.length} chunks ===\n`);
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks[i].split('\n')[0]?.slice(0, 60) ?? `chunk ${i + 1}`;
    console.log(`[${i + 1}/${chunks.length}] ${label}`);
    const ok = await runQuery(chunks[i]);
    if (!ok) return false;
  }

  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS _loyala_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      `INSERT INTO _loyala_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
      [MIGRATION]
    );
    await client.end();
  }

  console.log('SQL repair applied.');
  return true;
}

async function main() {
  const sql = await readFile(
    join(__dirname, '..', 'supabase', 'migrations', MIGRATION),
    'utf8'
  );

  const applied = await applySql(sql);
  if (!applied) {
    console.error(`
Cannot apply migrations without credentials.

Option A — DATABASE_URL (Supabase → Settings → Database → URI):
  $env:DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
  node scripts/apply-p4-production.mjs

Option B — Personal Access Token (supabase.com/dashboard/account/tokens):
  $env:SUPABASE_ACCESS_TOKEN="sbp_..."
  node scripts/apply-p4-production.mjs

Option C — SQL Editor: paste supabase/migrations/014_repair_go_live_gaps.sql
`);
    process.exit(2);
  }

  console.log('\n=== Post-apply audit ===\n');
  const auditEnv = { ...process.env };
  const auditStatus = runNode(join(__dirname, 'audit-supabase-migrations.mjs'), auditEnv);
  process.exit(auditStatus);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
