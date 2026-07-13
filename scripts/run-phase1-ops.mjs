#!/usr/bin/env node
/**
 * Phase 1 ops runner — loads .env.ops.local (never prints secret values).
 *
 * Steps:
 *  1. Apply migrations 020 → 024
 *  2. Verify 022 / 023 / 024
 *  3. Print WhatsApp + Vercel checklist from presence of keys
 *  4. Optionally submit Meta templates if --submit-templates
 *
 * Usage:
 *   cp .env.ops.local.example .env.ops.local   # then fill
 *   node scripts/run-phase1-ops.mjs
 *   node scripts/run-phase1-ops.mjs --submit-templates
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function loadEnv(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function run(label, args, env) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error(`FAILED: ${label} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

const fileEnv = loadEnv('.env.ops.local');
if (!fileEnv) {
  console.error('Missing .env.ops.local');
  console.error('  1. copy .env.ops.local.example → .env.ops.local');
  console.error('  2. fill DATABASE_URL (or SUPABASE_ACCESS_TOKEN) + WhatsApp keys');
  console.error('  3. re-run: node scripts/run-phase1-ops.mjs');
  process.exit(2);
}

const env = { ...process.env, ...fileEnv };
const hasDb = Boolean(env.DATABASE_URL || env.SUPABASE_ACCESS_TOKEN);
const waKeys = [
  'WHATSAPP_API_ENABLED',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
];

console.log('Phase 1 ops');
console.log(`  DATABASE/Token: ${hasDb ? 'OK' : 'MISSING'}`);
for (const k of waKeys) {
  console.log(`  ${k}: ${env[k] ? 'SET' : 'MISSING'}`);
}
console.log(`  WHATSAPP_TEST_CLIENT_ID: ${env.WHATSAPP_TEST_CLIENT_ID ? 'SET' : 'MISSING'}`);
console.log(`  RESEND_API_KEY: ${env.RESEND_API_KEY ? 'SET' : 'MISSING (Vercel)'}`);

if (!hasDb) {
  console.error('\nCannot apply migrations without DATABASE_URL or SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

run('apply 020→024', ['scripts/apply-phase1-whatsapp-migrations.mjs'], env);
run('verify-022', ['scripts/verify-022-whatsapp-messages.mjs'], env);
run('verify-023', ['scripts/verify-023-conversation-sessions.mjs'], env);
run('verify-024', ['scripts/verify-024-message-template-catalog.mjs'], env);

if (process.argv.includes('--submit-templates')) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('Need WHATSAPP_ACCESS_TOKEN + WHATSAPP_BUSINESS_ACCOUNT_ID for --submit-templates');
    process.exit(2);
  }
  run('submit Meta templates', ['scripts/submit-meta-whatsapp-templates.mjs'], env);
}

console.log('\n=== Manual remaining (dashboards) ===');
console.log('Railway — set WHATSAPP_* then check:');
console.log('  GET https://loyala-worker-production.up.railway.app/health → whatsapp.ready=true');
console.log('Meta — webhook URL:');
console.log('  https://loyala-worker-production.up.railway.app/whatsapp/webhook');
console.log('  fields: messages, message_status');
console.log('  verify token = WHATSAPP_WEBHOOK_VERIFY_TOKEN');
console.log('Vercel — AUTH_DEBUG=0 (or delete), set RESEND_API_KEY + RESEND_FROM_EMAIL');
console.log('After Meta APPROVED templates:');
console.log('  node scripts/mark-meta-templates-approved.mjs');
console.log('\nDone.');
