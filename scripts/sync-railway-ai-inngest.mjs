#!/usr/bin/env node
/**
 * Sync OpenAI + Inngest Railway vars from process.env (never logs values).
 * Usage:
 *   OPENAI_API_KEY=sk-... INNGEST_EVENT_KEY=... INNGEST_SIGNING_KEY=... node scripts/sync-railway-ai-inngest.mjs
 */
import { spawnSync } from 'node:child_process';

const required = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim(),
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY?.trim(),
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY?.trim(),
};

const missing = Object.entries(required)
  .filter(([, v]) => !v || v.includes('placeholder') || v.includes('configure'))
  .map(([k]) => k);

if (missing.length > 0) {
  console.error('Missing or placeholder env vars:', missing.join(', '));
  console.error(
    '\nSet them then re-run:\n' +
      '  OPENAI_API_KEY=sk-... INNGEST_EVENT_KEY=eventkey-prod-... INNGEST_SIGNING_KEY=signkey-prod-... node scripts/sync-railway-ai-inngest.mjs'
  );
  process.exit(1);
}

const keyTypeErrors = [];
if (required.INNGEST_SIGNING_KEY && !required.INNGEST_SIGNING_KEY.startsWith('signkey-')) {
  keyTypeErrors.push('INNGEST_SIGNING_KEY must start with signkey- (Signing Key from Inngest dashboard)');
}
if (required.INNGEST_EVENT_KEY && required.INNGEST_EVENT_KEY.startsWith('signkey-')) {
  keyTypeErrors.push(
    'INNGEST_EVENT_KEY looks like a Signing Key — use an Event Key (eventkey-prod-...) from Inngest → Manage → Event keys'
  );
}
if (
  required.INNGEST_EVENT_KEY &&
  required.INNGEST_SIGNING_KEY &&
  required.INNGEST_EVENT_KEY === required.INNGEST_SIGNING_KEY
) {
  keyTypeErrors.push('INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY must be different keys');
}
if (keyTypeErrors.length > 0) {
  console.error('Invalid Inngest key configuration:');
  for (const err of keyTypeErrors) console.error(`  - ${err}`);
  process.exit(1);
}

const MIN_KEY_LEN = 40;
if (required.INNGEST_SIGNING_KEY.length < MIN_KEY_LEN) {
  console.error(
    `INNGEST_SIGNING_KEY too short (${required.INNGEST_SIGNING_KEY.length} chars). ` +
      'Copy the full key from Inngest → Production → Signing Key (not the example signkey-prod-...).'
  );
  process.exit(1);
}
if (required.INNGEST_EVENT_KEY.length < MIN_KEY_LEN) {
  console.error(
    `INNGEST_EVENT_KEY too short (${required.INNGEST_EVENT_KEY.length} chars). ` +
      'Copy the full key from Inngest → Production → Event keys (not the example eventkey-prod-...).'
  );
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

railwaySet('OPENAI_API_KEY', required.OPENAI_API_KEY);
railwaySet('INNGEST_EVENT_KEY', required.INNGEST_EVENT_KEY);
railwaySet('INNGEST_SIGNING_KEY', required.INNGEST_SIGNING_KEY);
railwaySet('AI_ALLOW_MOCK', 'false');

console.log('\nDone. Railway will redeploy — verify /health then test /ai/inbox/classify (no mock-model in logs).');
console.log('Inngest: point sync URL to https://loyala-worker-production.up.railway.app/api/inngest');
