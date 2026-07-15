#!/usr/bin/env node
/**
 * Test Inngest keys against official APIs (status codes only, no secrets).
 * Usage: npx @railway/cli run node scripts/test-inngest-keys-cloud.mjs
 */
import { hashSigningKey } from '../apps/worker/node_modules/inngest/helpers/strings.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workerUrl =
  process.env.INNGEST_SERVE_ORIGIN?.trim() ||
  'https://loyala-worker-production.up.railway.app';
const signingKey = (process.env.INNGEST_SIGNING_KEY ?? '').trim();
const eventKey = (process.env.INNGEST_EVENT_KEY ?? '').trim();

let sdkVersion = '3.54.2';
try {
  const pkg = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../apps/worker/node_modules/inngest/version.js', import.meta.url)),
      'utf8'
    )
  );
  // version.js is minimal; read package.json instead
} catch {
  /* ignore */
}
try {
  const pkg = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../apps/worker/node_modules/inngest/package.json', import.meta.url)),
      'utf8'
    )
  );
  sdkVersion = pkg.version ?? sdkVersion;
} catch {
  /* ignore */
}

const out = {
  signingKey: { present: Boolean(signingKey), len: signingKey.length, prefix: signingKey.slice(0, 12) },
  eventKey: { present: Boolean(eventKey), len: eventKey.length },
  tests: {},
};

if (signingKey.startsWith('signkey-') && signingKey.length >= 40) {
  const authToken = hashSigningKey(signingKey);
  const registerBody = {
    url: `${workerUrl}/api/inngest`,
    deployType: 'ping',
    framework: 'nodejs',
    appName: 'loyala-worker',
    functions: [],
    sdk: `js:v${sdkVersion}`,
    v: '0.1',
  };
  const res = await fetch('https://api.inngest.com/fn/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(registerBody),
  });
  const data = await res.json().catch(() => ({}));
  const error = typeof data.error === 'string' ? data.error : null;
  const invalidSigning =
    res.status === 401 ||
    error?.toLowerCase().includes('signing key is invalid');
  out.tests.register = {
    httpStatus: res.status,
    ok: !invalidSigning && (res.ok || error === 'No functions registered within your app'),
    error,
  };
} else {
  out.tests.register = { ok: false, reason: 'invalid_signing_key_format' };
}

if (eventKey && eventKey.length >= 20 && !eventKey.startsWith('signkey-')) {
  const res = await fetch(`https://inn.gs/e/${encodeURIComponent(eventKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'loyala/validate.ping', data: { ts: Date.now() } }),
  });
  out.tests.eventPublish = { httpStatus: res.status, ok: res.ok };
} else {
  out.tests.eventPublish = { ok: false, reason: 'invalid_event_key_format' };
}

out.allOk = Boolean(out.tests.register?.ok && out.tests.eventPublish?.ok);
console.log(JSON.stringify(out, null, 2));
process.exit(out.allOk ? 0 : 1);
