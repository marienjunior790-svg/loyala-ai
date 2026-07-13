#!/usr/bin/env node
/** Apply one migration file via DATABASE_URL or SUPABASE_ACCESS_TOKEN (chunked). */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'nimjmyiggqgvledgwffv';
const file = process.argv[2] ?? '015_align_ai_logs_metrics.sql';

const sql = await readFile(join(__dirname, '..', 'supabase', 'migrations', file), 'utf8');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const databaseUrl = process.env.DATABASE_URL;
if (!token && !databaseUrl) {
  console.error('Need SUPABASE_ACCESS_TOKEN or DATABASE_URL');
  process.exit(2);
}

const chunks = sql
  .split(/^-- ───/m)
  .map((c, i) => (i === 0 ? c : `-- ───${c}`))
  .map((c) => c.trim())
  .filter((c) => c.length > 0 && !c.startsWith('-- Loyala AI'));

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
console.log('OK', file);
