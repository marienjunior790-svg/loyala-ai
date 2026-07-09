#!/usr/bin/env node
/**
 * Functional smoke tests for Campagnes module (schema + worker + Inngest).
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ optional WORKER_URL).
 */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const workerUrl = (
  process.env.WORKER_URL ??
  (railwayDomain ? `https://${railwayDomain}` : 'https://loyala-worker-production.up.railway.app')
).replace(/\/$/, '');
const workerSecret = process.env.WORKER_API_SECRET ?? '';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
}

async function rest(path, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function main() {
  if (!base || !key) {
    console.error('Missing Supabase env');
    process.exit(2);
  }

  // 1. Schema — organizations.plan_status (root cause of POST /campaigns 500)
  const orgCol = await rest('organizations?select=plan_status&limit=1');
  if (orgCol.ok) pass('schema.organizations.plan_status');
  else fail('schema.organizations.plan_status', orgCol.text.slice(0, 200));

  const orgFull = await rest(
    'organizations?select=id,name,slug,country_code,timezone,currency,plan,plan_status,settings&limit=1'
  );
  if (orgFull.ok) pass('schema.getOrganization_select');
  else fail('schema.getOrganization_select', orgFull.text.slice(0, 200));

  // 2. Schema — campaigns CRUD columns
  const camp = await rest('campaigns?select=id,type,name,status,metadata,scheduled_at&limit=1');
  if (camp.ok) pass('schema.campaigns');
  else fail('schema.campaigns', camp.text.slice(0, 200));

  const sends = await rest('campaign_sends?select=id,status,whatsapp_url&limit=1');
  if (sends.ok) pass('schema.campaign_sends');
  else fail('schema.campaign_sends', sends.text.slice(0, 200));

  // 3. RPC membership
  const rpc = await fetch(`${base}/rest/v1/rpc/get_my_active_membership`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (rpc.ok || rpc.status === 200) pass('rpc.get_my_active_membership');
  else fail('rpc.get_my_active_membership', String(rpc.status));

  // 4. Worker health
  if (workerUrl) {
    try {
      const h = await fetch(`${workerUrl}/health`, {
        headers: workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      const data = await h.json().catch(() => ({}));
      if (h.ok && data.status === 'ok') pass('worker.health', `inngest=${data.inngest}`);
      else fail('worker.health', `HTTP ${h.status}`);
    } catch (e) {
      fail('worker.health', e instanceof Error ? e.message : String(e));
    }

    // 5. Worker AI route exists (401 without auth is ok)
    try {
      const ai = await fetch(`${workerUrl}/ai/campaigns/loyalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: '00000000-0000-0000-0000-000000000001', clients: [] }),
        signal: AbortSignal.timeout(8000),
      });
      if (ai.status === 401 || ai.status === 400 || ai.ok) pass('worker.ai_campaigns_loyalty_route', `HTTP ${ai.status}`);
      else fail('worker.ai_campaigns_loyalty_route', `HTTP ${ai.status}`);
    } catch (e) {
      fail('worker.ai_campaigns_loyalty_route', e instanceof Error ? e.message : String(e));
    }

    // 6. Inngest endpoint registered
    try {
      const ing = await fetch(`${workerUrl}/api/inngest`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (ing.status === 200 || ing.status === 401 || ing.status === 405)
        pass('inngest.endpoint', `HTTP ${ing.status}`);
      else fail('inngest.endpoint', `HTTP ${ing.status}`);
    } catch (e) {
      fail('inngest.endpoint', e instanceof Error ? e.message : String(e));
    }
  } else {
    fail('worker.health', 'WORKER_URL not set');
  }

  // 7. Worker cron org filter (plan_status)
  if (orgCol.ok) {
    const activeOrgs = await rest(
      "organizations?select=id,name&deleted_at=is.null&plan_status=in.(trialing,active)&limit=5"
    );
    if (activeOrgs.ok) pass('worker.listActiveOrganizations_query');
    else fail('worker.listActiveOrganizations_query', activeOrgs.text.slice(0, 200));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
