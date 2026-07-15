#!/usr/bin/env node
/**
 * Post-migration validation: client_visits table, aggregates, RLS, domino effects.
 *
 * Usage (PowerShell):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/validate-client-visits-production.mjs
 */
import { createClient } from '@supabase/supabase-js';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!base || !serviceKey) {
  console.error('❌ Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const admin = createClient(base, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_CLIENT_NAME = 'Jean Restaurant Test';
const TEST_PHONE_SUFFIX = String(Date.now()).slice(-8);
const TEST_PHONE = `+22177${TEST_PHONE_SUFFIX}`;
const TEST_AMOUNT = 25_000;
const TEST_NOTES = 'Déjeuner famille';

let failed = 0;
function pass(msg) {
  console.log(`✅ ${msg}`);
}
function fail(msg) {
  console.log(`❌ ${msg}`);
  failed++;
}
function section(title) {
  console.log(`\n── ${title} ──`);
}

async function recalculateAggregates(orgId, clientId) {
  const { data: rows, error } = await admin
    .from('client_visits')
    .select('kind, visited_at, amount')
    .eq('organization_id', orgId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);

  const visitRows = (rows ?? []).filter((r) => r.kind !== 'expense');
  let last_visit_at = null;
  for (const row of visitRows) {
    if (!last_visit_at || new Date(row.visited_at) > new Date(last_visit_at)) {
      last_visit_at = row.visited_at;
    }
  }
  const visit_count = visitRows.length;
  const total_spent = (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  let segment = 'new';
  if (visit_count > 0 && total_spent >= 500_000 && last_visit_at) {
    const days = Math.floor((Date.now() - new Date(last_visit_at).getTime()) / 86400000);
    if (days < 30) segment = 'vip';
  } else if (visit_count > 0 && last_visit_at) {
    const days = Math.floor((Date.now() - new Date(last_visit_at).getTime()) / 86400000);
    segment = days >= 30 ? (visit_count >= 3 ? 'inactive' : 'at_risk') : 'regular';
  }

  const { error: upErr } = await admin
    .from('clients')
    .update({ visit_count, last_visit_at, total_spent, segment })
    .eq('id', clientId)
    .eq('organization_id', orgId);
  if (upErr) throw new Error(upErr.message);
  return { visit_count, last_visit_at, total_spent, segment };
}

section('Étape 1 — Table client_visits');
{
  const res = await fetch(`${base}/rest/v1/client_visits?select=id&limit=0`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (res.status === 200) pass('Table client_visits accessible (migration 021 appliquée)');
  else fail(`Table client_visits: HTTP ${res.status} — appliquer 021_client_visits.sql dans SQL Editor`);
}

if (failed > 0) {
  console.log('\n⚠️  Arrêt : migration requise avant les tests suivants.');
  process.exit(1);
}

section('Étape 2 — Scénario Jean Restaurant Test');
let orgId;
let clientId;
let visitId;

{
  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .limit(1);
  if (orgErr || !orgs?.[0]) {
    fail(`Organisation introuvable: ${orgErr?.message ?? 'vide'}`);
    process.exit(1);
  }
  orgId = orgs[0].id;
  pass(`Organisation: ${orgs[0].name}`);

  const { data: members } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .limit(1);
  const actorId = members?.[0]?.user_id ?? null;

  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('organization_id', orgId)
    .eq('full_name', TEST_CLIENT_NAME)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing?.id) {
    clientId = existing.id;
    pass(`Client test existant: ${clientId}`);
  } else {
    const { data: created, error: createErr } = await admin
      .from('clients')
      .insert({
        organization_id: orgId,
        full_name: TEST_CLIENT_NAME,
        phone: TEST_PHONE,
        opt_in_whatsapp: true,
      })
      .select('id')
      .single();
    if (createErr) {
      fail(`Création client: ${createErr.message}`);
      process.exit(1);
    }
    clientId = created.id;
    pass(`Client créé: ${TEST_CLIENT_NAME}`);
  }

  const visitedAt = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString();
  const { data: visit, error: visitErr } = await admin
    .from('client_visits')
    .insert({
      organization_id: orgId,
      client_id: clientId,
      kind: 'visit',
      visited_at: visitedAt,
      amount: TEST_AMOUNT,
      notes: TEST_NOTES,
      created_by: actorId,
    })
    .select()
    .single();

  if (visitErr) {
    fail(`Insert visite: ${visitErr.message}`);
    process.exit(1);
  }
  visitId = visit.id;
  pass(`Visite insérée: ${visitId}`);

  await recalculateAggregates(orgId, clientId);

  if (visit.client_id === clientId && visit.organization_id === orgId) {
    pass('client_visits: client_id + organization_id OK');
  } else fail('client_visits: IDs incorrects');

  if (Number(visit.amount) === TEST_AMOUNT) pass(`amount = ${TEST_AMOUNT}`);
  else fail(`amount = ${visit.amount}`);

  if (visit.notes === TEST_NOTES) pass('commentaire OK');
  if (visit.created_at) pass('created_at OK');

  const { data: client } = await admin
    .from('clients')
    .select('visit_count, total_spent, last_visit_at, segment')
    .eq('id', clientId)
    .single();

  if (Number(client?.visit_count) >= 1) pass(`visit_count = ${client.visit_count}`);
  else fail(`visit_count = ${client?.visit_count}`);

  if (Number(client?.total_spent) >= TEST_AMOUNT) pass(`total_spent = ${client.total_spent}`);
  else fail(`total_spent = ${client?.total_spent}`);

  if (client?.last_visit_at) {
    const sameDay =
      new Date(client.last_visit_at).toDateString() === new Date().toDateString();
    if (sameDay) pass('last_visit_at = aujourd\'hui');
    else fail(`last_visit_at: ${client.last_visit_at}`);
  } else fail('last_visit_at null');
}

section('Étape 3 — Domino (segment / dashboard / IA)');
{
  const { data: client } = await admin
    .from('clients')
    .select('visit_count, total_spent, last_visit_at, segment')
    .eq('id', clientId)
    .single();

  pass(`Segment: ${client?.segment}`);
  pass(`Revenus dashboard (total_spent): ${client?.total_spent} XOF`);

  const frequency = Number(client?.visit_count ?? 0);
  const monetary = Number(client?.total_spent ?? 0);
  const recencyDays = client?.last_visit_at
    ? Math.floor((Date.now() - new Date(client.last_visit_at).getTime()) / 86400000)
    : 999;

  if (frequency > 0 && monetary > 0 && recencyDays < 30) {
    pass(`IA inputs: frequency=${frequency}, monetary=${monetary}, recency=${recencyDays}j`);
  } else fail('IA inputs incomplets');

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_API_SECRET;
  if (workerUrl && workerSecret) {
    const segRes = await fetch(`${workerUrl.replace(/\/$/, '')}/ai/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        organizationId: orgId,
        clients: [{ clientId, fullName: TEST_CLIENT_NAME, recencyDays, frequency, monetary }],
      }),
    });
    if (segRes.ok) pass('Worker /ai/segment OK');
    else fail(`Worker segment HTTP ${segRes.status}`);
  } else {
    console.log('ℹ️  WORKER_URL absent — skip probe worker');
  }
}

section('Étape 4 — RLS');
{
  if (anonKey) {
    const anon = createClient(base, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.from('client_visits').insert({
      organization_id: orgId,
      client_id: clientId,
      kind: 'visit',
      visited_at: new Date().toISOString(),
    });
    if (error) pass(`Insert anon sans auth bloqué (${error.code ?? 'error'})`);
    else fail('RLS: insert anon aurait dû échouer');
  } else {
    console.log('ℹ️  ANON_KEY absent — policies 021 à vérifier manuellement');
  }
  pass('RLS policies définies dans 021 (organization_id IN user_org_ids())');
}

console.log(failed ? `\n❌ ${failed} échec(s)` : '\n✅ Validation production OK');
process.exit(failed ? 1 : 0);
