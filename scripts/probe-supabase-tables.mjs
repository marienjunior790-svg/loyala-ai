#!/usr/bin/env node
/** Detailed table probe via Supabase REST — no secrets logged. */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const tables = [
  'organizations',
  'roles',
  'organization_members',
  'domain_events',
  'clients',
  'ai_request_logs',
  'campaigns',
  'campaign_sends',
  'whatsapp_messages',
  'loyalty_transactions',
  'client_visits',
  'reviews',
  'notifications',
];

const headers = { apikey: key, Authorization: `Bearer ${key}` };

for (const table of tables) {
  const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { headers });
  const text = await res.text();
  const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
  console.log(`${table}: ${res.status} ${snippet}`);
}

const rpcTests = [
  ['get_tenant_ai_metrics', { p_organization_id: '00000000-0000-0000-0000-000000000001', p_since: new Date().toISOString() }],
  ['complete_onboarding', { p_organization_name: 'audit-probe' }],
  ['get_my_active_membership', {}],
];

for (const [fn, body] of rpcTests) {
  const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`rpc ${fn}: ${res.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
}

const bucket = await fetch(`${base}/storage/v1/bucket/org-assets`, { headers });
console.log(`bucket org-assets: ${bucket.status}`);
