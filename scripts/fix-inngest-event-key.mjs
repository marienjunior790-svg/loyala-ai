#!/usr/bin/env node
/**
 * Resolve truncated/wrong INNGEST_EVENT_KEY by fetching the full key from Inngest API.
 * Never logs secret values — only names, lengths, and HTTP status codes.
 *
 * Usage:
 *   npx @railway/cli run node scripts/fix-inngest-event-key.mjs
 *   npx @railway/cli run node scripts/fix-inngest-event-key.mjs --sync
 *   node scripts/fix-inngest-event-key.mjs --name "loyala-railway-prod" --sync
 */
import { hashSigningKey } from '../apps/worker/node_modules/inngest/helpers/strings.js';
import { spawnSync } from 'node:child_process';

const signingKey = (process.env.INNGEST_SIGNING_KEY ?? '').trim();
const syncToRailway = process.argv.includes('--sync');
const nameIdx = process.argv.indexOf('--name');
const keyName =
  (nameIdx >= 0 ? process.argv[nameIdx + 1] : process.env.INNGEST_EVENT_KEY_NAME) ??
  'loyala-railway-prod';

if (!signingKey.startsWith('signkey-')) {
  console.error('INNGEST_SIGNING_KEY required (use: npx @railway/cli run node scripts/fix-inngest-event-key.mjs)');
  process.exit(1);
}

const authToken = hashSigningKey(signingKey);
const listRes = await fetch('https://api.inngest.com/v2/keys/events', {
  headers: { Authorization: `Bearer ${authToken}` },
});
if (!listRes.ok) {
  console.error('Failed to list event keys:', listRes.status);
  process.exit(1);
}

const { data: keys = [] } = await listRes.json();
const report = {
  railwayEventKeyLen: (process.env.INNGEST_EVENT_KEY ?? '').trim().length,
  availableKeys: keys.map((k) => ({
    name: k.name,
    id: k.id,
    len: k.key?.length ?? 0,
    environment: k.environment,
  })),
  selected: null,
  eventKeyTest: null,
  ok: false,
};

const match =
  keys.find((k) => k.name === keyName) ??
  keys.find((k) => k.name === 'loyala-railway-prod') ??
  keys.find((k) => k.environment === 'production');

if (!match?.key) {
  console.error(`No production event key found (wanted name: ${keyName})`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

report.selected = { name: match.name, id: match.id, len: match.key.length, environment: match.environment };

const publishRes = await fetch(`https://inn.gs/e/${encodeURIComponent(match.key)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'loyala/validate.ping',
    data: { ts: Date.now(), source: 'fix-inngest-event-key' },
  }),
});
report.eventKeyTest = { httpStatus: publishRes.status, ok: publishRes.ok };
report.ok = publishRes.ok;
console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exit(1);
}

if (syncToRailway) {
  const vars = [
    ['INNGEST_EVENT_KEY', match.key],
    ['INNGEST_SERVE_ORIGIN', 'https://loyala-worker-production.up.railway.app'],
    ['AI_ALLOW_MOCK', 'true'],
  ];
  for (const [key, value] of vars) {
    const r = spawnSync(
      'npx',
      ['--yes', '@railway/cli', 'variables', 'set', `${key}=${value}`, '--service', 'loyala-worker'],
      { stdio: 'inherit', shell: true }
    );
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`Set ${key}`);
  }
  console.log('\nRailway INNGEST_EVENT_KEY updated. Redeploy if the running container does not hot-reload env.');
}
