#!/usr/bin/env node
/**
 * Validate Inngest sync using signing key (metadata only in output).
 * Simulates Inngest Cloud PUT /api/inngest introspection with proper Authorization.
 */
import { hashSigningKey } from '../apps/worker/node_modules/inngest/helpers/strings.js';

const base = process.argv[2] ?? 'https://loyala-worker-production.up.railway.app';
const signingKey = (process.env.INNGEST_SIGNING_KEY ?? '').trim();

if (!signingKey) {
  console.error('INNGEST_SIGNING_KEY not set');
  process.exit(1);
}

const authToken = hashSigningKey(signingKey);
const body = JSON.stringify({ url: `${base}/api/inngest` });

const res = await fetch(`${base}/api/inngest`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  },
  body,
});

const text = await res.text();
console.log(
  JSON.stringify(
    {
      method: 'PUT',
      status: res.status,
      bodyPreview: text.slice(0, 300),
      signingKeyType: signingKey.startsWith('signkey-') ? 'signing' : 'unknown',
      authOk: res.status === 200,
    },
    null,
    2
  )
);

process.exit(res.status === 200 ? 0 : 1);
