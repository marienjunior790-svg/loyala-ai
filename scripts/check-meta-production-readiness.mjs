#!/usr/bin/env node
/** Meta WhatsApp production readiness probe. Reads .env.ops.local */
import { existsSync, readFileSync } from 'node:fs';

function loadOps() {
  if (!existsSync('.env.ops.local')) throw new Error('Missing .env.ops.local');
  const env = {};
  for (const line of readFileSync('.env.ops.local', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

const env = loadOps();
const token = env.WHATSAPP_ACCESS_TOKEN;
const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
const version = env.WHATSAPP_API_VERSION || 'v21.0';

if (!token) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN');
  process.exit(2);
}

async function get(path, fields) {
  const url = `https://graph.facebook.com/${version}/${path}?fields=${encodeURIComponent(fields)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  return { ok: res.ok, json };
}

const checks = [];

// Token debug (no secret printed)
const me = await get('me', 'id,name');
checks.push({
  label: 'Access token valid',
  ok: me.ok,
  detail: me.ok ? me.json.name ?? me.json.id : me.json?.error?.message,
});

if (wabaId) {
  const waba = await get(
    wabaId,
    'name,account_review_status,message_template_namespace,business_verification_status'
  );
  checks.push({
    label: 'WABA reachable',
    ok: waba.ok,
    detail: waba.ok
      ? `${waba.json.name ?? wabaId} | review=${waba.json.account_review_status ?? 'n/a'} | biz_verify=${waba.json.business_verification_status ?? 'n/a'}`
      : waba.json?.error?.message,
  });
}

if (phoneId) {
  const phone = await get(
    phoneId,
    'display_phone_number,verified_name,quality_rating,status,code_verification_status,platform_type'
  );
  checks.push({
    label: 'Phone number',
    ok: phone.ok,
    detail: phone.ok
      ? `${phone.json.display_phone_number ?? '?'} | ${phone.json.verified_name ?? 'no name'} | status=${phone.json.status ?? 'n/a'} | quality=${phone.json.quality_rating ?? 'n/a'}`
      : phone.json?.error?.message,
  });
}

// Count approved templates
if (wabaId) {
  const tpl = await get(
    `${wabaId}/message_templates`,
    'name,status'
  );
  const data = tpl.ok ? tpl.json.data ?? [] : [];
  const loyala = data.filter((t) => t.name?.startsWith('loyala_'));
  const approved = loyala.filter((t) => t.status === 'APPROVED').length;
  const pending = loyala.filter((t) => t.status === 'PENDING').length;
  checks.push({
    label: 'Loyala templates',
    ok: approved > 0,
    detail: `${approved} approved, ${pending} pending (of ${loyala.length} submitted)`,
  });
}

console.log('\n=== Meta production readiness ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '⏳'} ${c.label}: ${c.detail}`);
}

const allTemplatesApproved = checks.find((c) => c.label === 'Loyala templates')?.detail?.startsWith('4 approved');
console.log('\n--- Next for Option B (Live) ---');
console.log('1. Meta Business Verification (if not verified)');
console.log('2. App → Publish / Switch to Live mode');
console.log('3. Wait templates APPROVED (currently all PENDING)');
console.log('4. Then: node scripts/mark-meta-templates-approved.mjs');
console.log('5. Then: node scripts/whatsapp-pilot-send.mjs (loyala_inactive_v1)');
