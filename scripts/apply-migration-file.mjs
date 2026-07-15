#!/usr/bin/env node
/** Apply one migration file via DATABASE_URL or SUPABASE_ACCESS_TOKEN (chunked). */
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const file = process.argv[2] ?? '015_align_ai_logs_metrics.sql';

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

const sql = await readFile(join(root, 'supabase', 'migrations', file), 'utf8');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const databaseUrl = process.env.DATABASE_URL;if (!token && !databaseUrl) {
  console.error('Need SUPABASE_ACCESS_TOKEN or DATABASE_URL');
  process.exit(2);
}

function stripLeadingComments(sqlText) {
  const lines = sqlText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('--')) {
      i += 1;
      continue;
    }
    break;
  }
  return lines.slice(i).join('\n').trim();
}

const chunks = sql
  .split(/^-- ───/m)
  .map((c, i) => (i === 0 ? c : `-- ───${c}`))
  .map((c) => stripLeadingComments(c))
  .filter((c) => c.length > 0);

async function runQuery(query) {
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      await client.query(query);
    } finally {
      await client.end();
    }
    return true;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('API error:', res.status, text.slice(0, 600));
    return false;
  }
  return true;
}

console.log(`Applying ${file} (${chunks.length} chunks)`);
for (let i = 0; i < chunks.length; i++) {
  console.log(`[${i + 1}/${chunks.length}]`, chunks[i].split('\n')[0]?.slice(0, 70));
  if (!(await runQuery(chunks[i]))) process.exit(1);
}

// Always record in tracker (migrations 021–024 historically omitted this INSERT)
const trackSql = `
CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO _loyala_migrations (name) VALUES ('${file.replace(/'/g, "''")}')
ON CONFLICT (name) DO NOTHING;
`;
if (!(await runQuery(trackSql))) {
  console.error('Applied SQL but failed to update _loyala_migrations tracker');
  process.exit(1);
}
console.log('OK', file, '(tracker updated)');
