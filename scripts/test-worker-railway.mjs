#!/usr/bin/env node
/**
 * Validate Railway worker endpoints (reads WORKER_API_SECRET from env or .env.worker-secret.local).
 * Usage: node scripts/test-worker-railway.mjs [baseUrl]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'https://loyala-worker-production.up.railway.app';

function loadSecret() {
  if (process.env.WORKER_API_SECRET) return process.env.WORKER_API_SECRET;
  const local = resolve('.env.worker-secret.local');
  if (!existsSync(local)) throw new Error('WORKER_API_SECRET not set and .env.worker-secret.local missing');
  const line = readFileSync(local, 'utf8').split('\n').find((l) => l.startsWith('WORKER_API_SECRET='));
  if (!line) throw new Error('WORKER_API_SECRET not found in .env.worker-secret.local');
  return line.slice('WORKER_API_SECRET='.length).trim();
}

const secret = loadSecret();
const auth = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };

async function probe(name, method, path, body, { skipAuth = false } = {}) {
  const url = `${base}${path}`;
  const headers = skipAuth
    ? { 'Content-Type': 'application/json' }
    : method === 'GET'
      ? { Authorization: auth.Authorization }
      : auth;
  const opts = { method, headers, signal: AbortSignal.timeout(20000) };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text.slice(0, 200);
    }
    return { name, status: res.status, ok: res.status >= 200 && res.status < 300, body: json };
  } catch (error) {
    return {
      name,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const tests = [
  probe('health', 'GET', '/health'),
  probe('ai-classify', 'POST', '/ai/inbox/classify', {
    organizationId: 'test-org',
    messageId: 'm1',
    text: 'Bonjour je voudrais reserver',
    channel: 'whatsapp',
  }),
  probe('campaigns-birthday', 'POST', '/ai/campaigns/birthday', {
    organizationId: 'test-org',
    clients: [{ id: 'c1', name: 'Jean', birthday: '1990-05-15' }],
    restaurantName: 'Test Resto',
  }),
  probe('segment', 'POST', '/ai/segment', {
    organizationId: 'test-org',
    clients: [
      { id: 'c1', name: 'Jean', totalSpent: 500, visitCount: 10, lastVisit: '2025-01-01' },
    ],
  }),
  probe('ai-stats', 'GET', '/ai/stats?organizationId=test-org'),
  probe('unauthorized', 'POST', '/ai/inbox/classify', { organizationId: 'x', text: 'hi' }, { skipAuth: true }),
];

const results = await Promise.all(tests);
// unauthorized should be 401
const unauthorized = results.find((r) => r.name === 'unauthorized');
if (unauthorized) unauthorized.ok = unauthorized.status === 401;

console.log(`\n=== Worker validation: ${base} ===\n`);
for (const r of results) {
  const flag = r.ok ? 'PASS' : 'FAIL';
  const detail = r.error ?? JSON.stringify(r.body).slice(0, 180);
  console.log(`${flag}  ${r.status}\t${r.name}\t${detail}`);
}

const failed = results.filter((r) => !r.ok);
process.exit(failed.length > 0 ? 1 : 0);
