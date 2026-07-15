#!/usr/bin/env node
/**
 * Validate Inngest keys against Inngest Cloud BEFORE syncing to Railway.
 * Exits 0 only if both keys are accepted by Inngest API.
 * Never logs secret values.
 */
import { hashSigningKey } from '../apps/worker/node_modules/inngest/helpers/strings.js';
import { spawnSync } from 'node:child_process';

const signingKey = (process.env.INNGEST_SIGNING_KEY ?? '').trim();
const eventKey = (process.env.INNGEST_EVENT_KEY ?? '').trim();
const syncToRailway = process.argv.includes('--sync');

if (!signingKey || !eventKey) {
  console.error('Set INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY');
  process.exit(1);
}

const report = { signingKey: {}, eventKey: {}, ok: false };

if (!signingKey.startsWith('signkey-') || signingKey.length < 40) {
  report.signingKey = { ok: false, reason: 'invalid_format_or_length' };
} else {
  const authToken = hashSigningKey(signingKey);
  const workerUrl =
    process.env.INNGEST_SERVE_ORIGIN?.trim() ||
    'https://loyala-worker-production.up.railway.app';
  const res = await fetch('https://api.inngest.com/fn/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      url: `${workerUrl}/api/inngest`,
      deployType: 'ping',
      framework: 'nodejs',
      appName: 'loyala-worker',
      functions: [],
      sdk: 'js:v3.54.2',
      v: '0.1',
    }),
  });
  const data = await res.json().catch(() => ({}));
  const error = typeof data.error === 'string' ? data.error : undefined;
  const invalidSigning =
    res.status === 401 ||
    error?.toLowerCase().includes('signing key is invalid') ||
    (typeof data.message === 'string' &&
      data.message.toLowerCase().includes('signing key is invalid'));
  // Empty functions[] yields 500 but proves the signing key is accepted by Inngest Cloud.
  report.signingKey = {
    ok: !invalidSigning && (res.ok || error === 'No functions registered within your app'),
    httpStatus: res.status,
    error,
  };
}

if (eventKey.startsWith('signkey-') || eventKey.length < 20) {
  report.eventKey = { ok: false, reason: 'invalid_format_or_length' };
} else {
  const res = await fetch(`https://inn.gs/e/${encodeURIComponent(eventKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'loyala/validate.ping', data: { ts: Date.now() } }),
  });
  report.eventKey = { ok: res.status >= 200 && res.status < 300, httpStatus: res.status };
}

report.ok = Boolean(report.signingKey.ok && report.eventKey.ok);
console.log(JSON.stringify(report, null, 2));

if (!report.signingKey.ok) {
  console.error('\nSigning key rejected by Inngest Cloud — fix in dashboard before syncing Railway.');
  console.error('Signing: Production → Keys → Signing keys → Current key → Copy');
  process.exit(1);
}

if (!report.eventKey.ok) {
  console.error('\nEvent key rejected (event_key_not_found) — recreate in Production → Keys → Event keys.');
  console.error('Signing key is valid; use --sync to push signing key to Railway anyway.');
  if (!syncToRailway) process.exit(1);
}

if (!report.ok && !syncToRailway) {
  process.exit(1);
}

if (syncToRailway) {
  for (const [key, value] of [
    ['INNGEST_SIGNING_KEY', signingKey],
    ['INNGEST_EVENT_KEY', eventKey],
    ['INNGEST_SERVE_ORIGIN', 'https://loyala-worker-production.up.railway.app'],
    ['AI_ALLOW_MOCK', 'true'],
  ]) {
    const r = spawnSync('npx', ['--yes', '@railway/cli', 'variables', 'set', `${key}=${value}`], {
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`Set ${key}`);
  }
  console.log('\nRailway updated. Wait ~2 min then run: node scripts/probe-inngest-endpoint.mjs');
}

process.exit(0);
