#!/usr/bin/env node
/**
 * Sync Inngest keys to Railway only (OpenAI not required).
 * Usage:
 *   INNGEST_EVENT_KEY=eventkey-prod-... INNGEST_SIGNING_KEY=signkey-prod-... node scripts/sync-railway-inngest.mjs
 */
import { spawnSync } from 'node:child_process';

const eventKey = process.env.INNGEST_EVENT_KEY?.trim();
const signingKey = process.env.INNGEST_SIGNING_KEY?.trim();

if (!eventKey || !signingKey) {
  console.error('Missing INNGEST_EVENT_KEY and/or INNGEST_SIGNING_KEY');
  console.error(
    '\nUsage:\n' +
      '  INNGEST_EVENT_KEY=eventkey-prod-... INNGEST_SIGNING_KEY=signkey-prod-... node scripts/sync-railway-inngest.mjs'
  );
  process.exit(1);
}

const keyTypeErrors = [];
if (!signingKey.startsWith('signkey-')) {
  keyTypeErrors.push('INNGEST_SIGNING_KEY must start with signkey-');
}
if (eventKey.startsWith('signkey-')) {
  keyTypeErrors.push('INNGEST_EVENT_KEY must be an Event Key (eventkey-prod-...), not a Signing Key');
}
if (eventKey === signingKey) {
  keyTypeErrors.push('INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY must be different');
}
const MIN_KEY_LEN = 40;
if (signingKey.length < MIN_KEY_LEN) {
  keyTypeErrors.push(`INNGEST_SIGNING_KEY too short (${signingKey.length} chars) — copy full key from Inngest`);
}
if (eventKey.length < MIN_KEY_LEN) {
  keyTypeErrors.push(`INNGEST_EVENT_KEY too short (${eventKey.length} chars) — copy full key from Inngest`);
}
if (keyTypeErrors.length > 0) {
  console.error('Invalid Inngest keys:');
  for (const err of keyTypeErrors) console.error(`  - ${err}`);
  process.exit(1);
}

function railwaySet(key, value) {
  const r = spawnSync('npx', ['--yes', '@railway/cli', 'variables', 'set', `${key}=${value}`], {
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`Set ${key}`);
}

railwaySet('INNGEST_EVENT_KEY', eventKey);
railwaySet('INNGEST_SIGNING_KEY', signingKey);
railwaySet('AI_ALLOW_MOCK', 'true');

console.log('\nDone. Railway will redeploy.');
console.log('Inngest sync URL: https://loyala-worker-production.up.railway.app/api/inngest');
console.log('OpenAI: not configured — worker uses mock AI until you add OPENAI_API_KEY later.');
