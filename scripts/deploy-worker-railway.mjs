#!/usr/bin/env node
/**
 * Deploy Loyala worker to Railway (requires `railway login` first).
 *
 * Usage:
 *   node scripts/deploy-worker-railway.mjs
 *
 * Or manually:
 *   railway login
 *   railway init --name loyala-worker   # once
 *   railway up --detach
 *   railway domain
 *   curl $(railway domain)/health
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function runCapture(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: true });
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}

const whoami = runCapture('npx', ['@railway/cli', 'whoami']);
if (whoami.status !== 0 || whoami.stdout.includes('Unauthorized')) {
  console.error('\nRailway: not authenticated. Run: npx @railway/cli login');
  process.exit(1);
}
console.log('Railway user:', whoami.stdout);

// Deploy from repo root (railway.toml + apps/worker/Dockerfile)
run('npx', ['@railway/cli', 'up', '--detach']);

const domain = runCapture('npx', ['@railway/cli', 'domain']);
const url = domain.stdout.split('\n').find((l) => l.startsWith('http')) ?? domain.stdout;
console.log('\nWorker URL:', url);

if (url.startsWith('http')) {
  const healthUrl = `${url.replace(/\/$/, '')}/health`;
  console.log('Probing', healthUrl);
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(30000) });
  const body = await res.text();
  console.log('Health:', res.status, body);
  if (res.status !== 200) process.exit(1);
}
