#!/usr/bin/env node
/**
 * Finalize CRM schema sync: apply 016+017, probe, report.
 * Loads credentials from env files + Supabase CLI token file.
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function run(label, script, extraEnv = {}) {
  console.log(`\n=== ${label} ===\n`);
  const r = spawnSync('node', [script], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    cwd: join(__dirname, '..'),
  });
  return r.status ?? 1;
}

const syncStatus = run('Apply migrations 016+017', join(__dirname, 'sync-crm-schema-production.mjs'));
if (syncStatus !== 0) process.exit(syncStatus);

const probeStatus = run('Schema probe', join(__dirname, 'probe-schema-gaps.mjs'));
if (probeStatus !== 0) process.exit(probeStatus);

console.log('\n=== SUCCESS: schema aligned ===\n');
console.log('Next: verify production pages /clients /fidelite /campaigns /relances /notifications');
