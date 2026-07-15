#!/usr/bin/env node
/**
 * Full Inngest integration diagnostic (no secrets logged).
 * Usage: node scripts/diagnose-inngest.mjs [workerBaseUrl]
 * Railway: npx @railway/cli run node scripts/diagnose-inngest.mjs
 */
import { hashSigningKey } from '../apps/worker/node_modules/inngest/helpers/strings.js';

const base = process.argv[2] ?? 'https://loyala-worker-production.up.railway.app';
const signingKey = (process.env.INNGEST_SIGNING_KEY ?? '').trim();
const eventKey = (process.env.INNGEST_EVENT_KEY ?? '').trim();

function classifySigningKey() {
  if (!signingKey) return { status: 'absent' };
  if (signingKey.includes('placeholder')) return { status: 'invalid', reason: 'placeholder' };
  if (!signingKey.startsWith('signkey-')) return { status: 'invalid', reason: 'wrong_prefix' };
  if (signingKey.length < 40) return { status: 'invalid', reason: 'too_short', len: signingKey.length };
  return { status: 'present', len: signingKey.length };
}

function classifyEventKey() {
  if (!eventKey) return { status: 'absent' };
  if (eventKey.includes('placeholder')) return { status: 'invalid', reason: 'placeholder' };
  if (eventKey.startsWith('signkey-')) return { status: 'invalid', reason: 'signing_key_used_as_event' };
  if (eventKey.length < 20) return { status: 'invalid', reason: 'too_short', len: eventKey.length };
  return { status: 'present', len: eventKey.length };
}

const report = {
  runtime: {
    NODE_ENV: process.env.NODE_ENV ?? 'unset',
    INNGEST_DEV: process.env.INNGEST_DEV ?? 'unset',
    PORT: process.env.PORT ?? 'unset',
  },
  keys: {
    INNGEST_SIGNING_KEY: classifySigningKey(),
    INNGEST_EVENT_KEY: classifyEventKey(),
  },
  worker: {},
  inngestCloud: {},
};

try {
  const health = await fetch(`${base}/health`);
  report.worker.health = { status: health.status, ok: health.ok };
} catch (e) {
  report.worker.health = { status: 0, error: e instanceof Error ? e.message : 'fetch failed' };
}

for (const method of ['GET', 'PUT']) {
  try {
    const res = await fetch(`${base}/api/inngest`, { method });
    const text = await res.text();
    report.worker[`inngest_${method}`] = { status: res.status, message: JSON.parse(text).message ?? text.slice(0, 80) };
  } catch (e) {
    report.worker[`inngest_${method}`] = { status: 0, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

if (eventKey && classifyEventKey().status === 'present') {
  try {
    const res = await fetch(`https://inn.gs/e/${encodeURIComponent(eventKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'loyala/diagnostic.ping', data: { ts: Date.now() } }),
    });
    report.inngestCloud.eventKeyTest = {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
    };
  } catch (e) {
    report.inngestCloud.eventKeyTest = { status: 0, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

if (signingKey && classifySigningKey().status === 'present') {
  try {
    const authToken = hashSigningKey(signingKey);
    const res = await fetch('https://api.inngest.com/v1/apps', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    report.inngestCloud.signingKeyApiTest = {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
    };
  } catch (e) {
    report.inngestCloud.signingKeyApiTest = {
      status: 0,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }

  try {
    const authToken = hashSigningKey(signingKey);
    const body = JSON.stringify({
      app_id: 'loyala-worker',
      framework: 'nodejs',
      functions: [],
      sdk: { name: 'diagnostic', version: '0' },
      url: `${base}/api/inngest`,
    });
    const res = await fetch('https://api.inngest.com/v1/apps/loyala-worker/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const text = await res.text();
    let message = text.slice(0, 120);
    try {
      message = JSON.parse(text).error ?? JSON.parse(text).message ?? message;
    } catch {
      /* plain text */
    }
    report.inngestCloud.registerTest = { status: res.status, ok: res.ok, message };
  } catch (e) {
    report.inngestCloud.registerTest = {
      status: 0,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.worker.inngest_PUT?.status === 200 ? 0 : 1);
