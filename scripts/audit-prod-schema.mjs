#!/usr/bin/env node
/**
 * Full production schema audit — compares REST column probes to repo expectations.
 * Exit 0 when all columns ok; exit 1 with missing list.
 */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const EXPECTED = {
  organizations: [
    'id', 'slug', 'name', 'country_code', 'timezone', 'currency', 'vertical',
    'plan', 'plan_status', 'settings', 'created_at', 'updated_at', 'deleted_at',
  ],
  organization_members: [
    'id', 'organization_id', 'user_id', 'role_id', 'status', 'joined_at', 'created_at',
  ],
  roles: ['id', 'scope', 'code', 'name', 'permissions', 'level'],
  clients: [
    'id', 'organization_id', 'full_name', 'phone', 'email', 'segment', 'visit_count',
    'total_spent', 'loyalty_points', 'last_visit_at', 'opt_in_whatsapp', 'notes',
    'date_of_birth', 'created_at', 'updated_at', 'deleted_at',
  ],
  campaigns: [
    'id', 'organization_id', 'type', 'name', 'status', 'message_preview', 'target_count',
    'metadata', 'scheduled_at', 'created_by', 'created_at', 'updated_at',
  ],
  campaign_sends: [
    'id', 'organization_id', 'campaign_id', 'client_id', 'channel', 'message_body',
    'status', 'whatsapp_url', 'sent_at', 'created_at',
  ],
  notifications: [
    'id', 'organization_id', 'user_id', 'title', 'body', 'type', 'link', 'read_at', 'created_at',
  ],
  loyalty_transactions: [
    'id', 'organization_id', 'client_id', 'points_delta', 'reason', 'created_by', 'created_at',
  ],
  reviews: [
    'id', 'organization_id', 'client_id', 'source', 'rating', 'author_name', 'content',
    'review_url', 'response_text', 'responded_at', 'reviewed_at', 'created_at',
  ],
  ai_request_logs: [
    'id', 'request_id', 'organization_id', 'use_case', 'provider', 'model',
    'input_tokens', 'output_tokens', 'cost_usd', 'latency_ms', 'cached', 'success',
    'error_message', 'created_at',
  ],
  domain_events: [
    'id', 'organization_id', 'event_type', 'event_version', 'aggregate_type',
    'aggregate_id', 'actor_id', 'payload', 'metadata', 'created_at',
  ],
};

async function probeColumn(table, col) {
  const res = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=0`, {
    headers,
  });
  const text = await res.text();
  const missing =
    !res.ok &&
    (text.includes('does not exist') ||
      text.includes('Could not find') ||
      (text.includes('column') && text.includes('not found')));
  return { status: res.ok ? 'ok' : missing ? 'missing' : `error_${res.status}`, snippet: text.slice(0, 120) };
}

async function probeRpc(name, body = {}) {
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, snippet: text.slice(0, 150) };
}

const report = {};
const missing = [];

for (const [table, columns] of Object.entries(EXPECTED)) {
  report[table] = {};
  for (const col of columns) {
    const r = await probeColumn(table, col);
    report[table][col] = r.status;
    if (r.status !== 'ok') missing.push(`${table}.${col}`);
  }
}

const rpcs = {
  get_my_active_membership: await probeRpc('get_my_active_membership'),
  user_org_ids: await probeRpc('user_org_ids'),
};

console.log(
  JSON.stringify(
    {
      audited_at: new Date().toISOString(),
      supabase_host: base.replace(/^https?:\/\//, '').split('/')[0],
      missing,
      missing_count: missing.length,
      report,
      rpcs,
    },
    null,
    2
  )
);

process.exit(missing.length === 0 ? 0 : 1);
