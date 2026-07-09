#!/usr/bin/env node
/** Probe expected CRM columns via Supabase REST (status only). */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const ORGANIZATION_COLUMNS = [
  'id',
  'slug',
  'name',
  'country_code',
  'timezone',
  'currency',
  'vertical',
  'plan',
  'plan_status',
  'settings',
  'created_at',
  'updated_at',
  'deleted_at',
];

const CLIENT_COLUMNS = [
  'id',
  'organization_id',
  'full_name',
  'phone',
  'email',
  'segment',
  'visit_count',
  'total_spent',
  'loyalty_points',
  'last_visit_at',
  'opt_in_whatsapp',
  'notes',
  'date_of_birth',
  'created_at',
  'updated_at',
  'deleted_at',
];

const CAMPAIGN_COLUMNS = [
  'id',
  'organization_id',
  'type',
  'name',
  'status',
  'message_preview',
  'target_count',
  'metadata',
  'scheduled_at',
  'created_by',
  'created_at',
  'updated_at',
];

const SEND_COLUMNS = [
  'id',
  'organization_id',
  'campaign_id',
  'client_id',
  'channel',
  'message_body',
  'status',
  'whatsapp_url',
  'sent_at',
  'created_at',
];

const NOTIFICATION_COLUMNS = [
  'id',
  'organization_id',
  'user_id',
  'title',
  'body',
  'type',
  'link',
  'read_at',
  'created_at',
];

const LOYALTY_TX_COLUMNS = [
  'id',
  'organization_id',
  'client_id',
  'points_delta',
  'reason',
  'created_by',
  'created_at',
];

async function probeTable(table, columns) {
  const results = {};
  for (const col of columns) {
    const res = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=0`, {
      headers,
    });
    const text = await res.text();
    const missing =
      text.includes('does not exist') ||
      text.includes('Could not find') ||
      text.includes('column') && text.includes('not found');
    results[col] = res.ok ? 'ok' : missing ? 'missing' : `error_${res.status}`;
  }
  return results;
}

const report = {
  organizations: await probeTable('organizations', ORGANIZATION_COLUMNS),
  clients: await probeTable('clients', CLIENT_COLUMNS),
  campaigns: await probeTable('campaigns', CAMPAIGN_COLUMNS),
  campaign_sends: await probeTable('campaign_sends', SEND_COLUMNS),
  loyalty_transactions: await probeTable('loyalty_transactions', LOYALTY_TX_COLUMNS),
  notifications: await probeTable('notifications', NOTIFICATION_COLUMNS),
};

const missing = [];
for (const [table, cols] of Object.entries(report)) {
  for (const [col, status] of Object.entries(cols)) {
    if (status !== 'ok') missing.push(`${table}.${col}`);
  }
}

console.log(JSON.stringify({ missing, report }, null, 2));
process.exit(missing.length === 0 ? 0 : 1);
