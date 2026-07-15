#!/usr/bin/env node
/** Print Railway env presence flags only — never secret values. */
const keys = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
  'AI_ALLOW_MOCK',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
];

function isPlaceholder(name, value) {
  if (!value) return true;
  const v = value.toLowerCase();
  if (name.includes('OPENAI') && (v.includes('configure') || v === 'sk-')) return true;
  if (name.includes('INNGEST') && v.includes('placeholder')) return true;
  if (name === 'SUPABASE_SERVICE_ROLE_KEY' && (v === 'test-service-role-key' || v.includes('placeholder')))
    return true;
  return false;
}

function inngestKeyType(name, value) {
  if (!value) return 'absent';
  if (name === 'INNGEST_SIGNING_KEY') {
    if (value.startsWith('signkey-')) return 'correct';
    return 'incorrect';
  }
  if (name === 'INNGEST_EVENT_KEY') {
    if (value.startsWith('signkey-')) return 'incorrect';
    if (value.startsWith('eventkey-') || value.startsWith('evtkey-')) return 'correct';
    return 'unknown';
  }
  return 'n/a';
}

const report = {};
for (const key of keys) {
  const value = process.env[key];
  const entry = {
    set: Boolean(value),
    placeholder: isPlaceholder(key, value ?? ''),
  };
  if (key.startsWith('INNGEST_')) {
    entry.keyType = inngestKeyType(key, value ?? '');
    if (value && value.length < 40) entry.keyLength = 'too_short';
    else if (value) entry.keyLength = 'ok';
  }
  report[key] = entry;
}
console.log(JSON.stringify(report, null, 2));
