#!/usr/bin/env node
/**
 * Apply migration 017 (CRM schema gaps) via DATABASE_URL or SUPABASE_ACCESS_TOKEN.
 * Then re-probe missing columns. Never logs secrets.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'nimjmyiggqgvledgwffv';
const MIGRATION = '017_align_crm_schema_gaps.sql';
const sql = await readFile(join(__dirname, '..', 'supabase', 'migrations', MIGRATION), 'utf8');

async function applyPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`apply ${MIGRATION} via DATABASE_URL...`);
  await client.query(sql);
  await client.end();
  console.log(`ok ${MIGRATION}`);
  return true;
}

async function applyApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
  // Split on section markers for Management API size limits
  const chunks = sql
    .split(/^-- ───/m)
    .map((c, i) => (i === 0 ? c : `-- ───${c}`))
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  console.log(`apply ${MIGRATION} via Management API (${chunks.length} chunks)...`);
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks[i].split('\n')[0]?.slice(0, 70) ?? `chunk ${i + 1}`;
    console.log(`[${i + 1}/${chunks.length}] ${label}`);
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: chunks[i] }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error('API failed:', res.status, body.slice(0, 500));
      return false;
    }
  }
  console.log(`ok ${MIGRATION}`);
  return true;
}

if (!(await applyPg()) && !(await applyApi())) {
  console.error(
    `Need DATABASE_URL or SUPABASE_ACCESS_TOKEN to apply ${MIGRATION}.\n` +
      'Then re-run: npx @railway/cli run --service loyala-worker node scripts/probe-schema-gaps.mjs'
  );
  process.exit(2);
}

console.log('\n=== Re-probe schema gaps ===\n');
const probe = spawnSync('node', [join(__dirname, 'probe-schema-gaps.mjs')], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(probe.status ?? 0);
