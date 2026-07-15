#!/usr/bin/env node
/** Apply 023/024 + submit Meta templates using .env.ops.local (no secret logging). */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadOpsEnv() {
  const path = '.env.ops.local';
  if (!existsSync(path)) throw new Error('Missing .env.ops.local');
  const env = { ...process.env };
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
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

function run(label, args, env) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(r.status ?? 1);
  }
}

function runSqlFile(label, relativePath, env) {
  console.log(`\n=== ${label} ===`);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL missing');
    process.exit(2);
  }
  const sql = readFileSync(join(root, relativePath), 'utf8');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  return client
    .connect()
    .then(() => client.query(sql))
    .then(() => client.end())
    .catch((e) => {
      console.error('FAILED:', e instanceof Error ? e.message : e);
      process.exit(1);
    });
}

const env = loadOpsEnv();
const submitOnly = process.argv.includes('--submit-only');

if (!submitOnly) {
  await runSqlFile('ensure set_updated_at()', 'scripts/sql/ensure-set-updated-at.sql', env);

  for (const file of [
    '023_conversation_sessions.sql',
    '024_message_template_catalog.sql',
  ]) {
    run(`apply ${file}`, ['scripts/apply-migration-file.mjs', file], env);
  }

  run('verify-023', ['scripts/verify-023-conversation-sessions.mjs'], env);
  run('verify-024', ['scripts/verify-024-message-template-catalog.mjs'], env);
}

run('submit Meta templates', ['scripts/submit-meta-whatsapp-templates.mjs'], env);

console.log('\nDone. After Meta approves templates:');
console.log('  node scripts/mark-meta-templates-approved.mjs');
