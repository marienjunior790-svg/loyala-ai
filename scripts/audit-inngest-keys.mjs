#!/usr/bin/env node
/**
 * Audit Inngest key configuration (metadata only — never logs secret values).
 * Usage: node scripts/audit-inngest-keys.mjs
 * Railway: npx @railway/cli run node scripts/audit-inngest-keys.mjs
 */
const signing = (process.env.INNGEST_SIGNING_KEY ?? '').trim();
const event = (process.env.INNGEST_EVENT_KEY ?? '').trim();

function classifyKey(name, value) {
  if (!value) return { status: 'absent', type: null };
  const lower = value.toLowerCase();
  if (lower.includes('placeholder') || lower.includes('configure')) {
    return { status: 'placeholder', type: null };
  }
  let type = 'unknown';
  if (value.startsWith('signkey-')) type = 'signing';
  else if (value.startsWith('eventkey-') || value.startsWith('evtkey-')) type = 'event';
  else if (name === 'INNGEST_EVENT_KEY' && value.length >= 20) type = 'event';
  return { status: 'set', type, len: value.length };
}

const signingInfo = classifyKey('INNGEST_SIGNING_KEY', signing);
const eventInfo = classifyKey('INNGEST_EVENT_KEY', event);

const issues = [];
if (signingInfo.status !== 'set' || signingInfo.type !== 'signing') {
  issues.push('INNGEST_SIGNING_KEY: ✗ incorrect (expected signkey-prod-*)');
} else {
  issues.push('INNGEST_SIGNING_KEY: ✓ correct type');
}
if (eventInfo.status !== 'set' || eventInfo.type !== 'event') {
  issues.push(
    `INNGEST_EVENT_KEY: ✗ incorrect (got type=${eventInfo.type ?? 'none'}, expected event key ≥20 chars)`
  );
} else {
  issues.push('INNGEST_EVENT_KEY: ✓ correct type');
}
if (signing && event && signing === event) {
  issues.push('INNGEST keys: ✗ EVENT_KEY and SIGNING_KEY are identical');
}

console.log(
  JSON.stringify(
    {
      INNGEST_SIGNING_KEY: signingInfo,
      INNGEST_EVENT_KEY: eventInfo,
      sameValue: Boolean(signing && event && signing === event),
      issues,
    },
    null,
    2
  )
);
