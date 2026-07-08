#!/usr/bin/env node
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) process.exit(2);
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe(path) {
  const res = await fetch(`${base}/rest/v1/${path}`, { headers });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
}

const members = await probe('organization_members?select=user_id,organization_id,role_id,status&status=eq.active&limit=10');
let parsed = [];
try {
  parsed = JSON.parse(members.body);
} catch {
  /* */
}

const nullRole = Array.isArray(parsed) ? parsed.filter((m) => !m.role_id).length : null;
const total = Array.isArray(parsed) ? parsed.length : 0;

const roles = await probe('roles?select=code,id&scope=eq.organization&limit=10');

console.log(
  JSON.stringify(
    {
      active_members_sample: total,
      null_role_id_in_sample: nullRole,
      members_ok: members.ok,
      roles_ok: roles.ok,
      roles: roles.ok ? JSON.parse(roles.body) : roles.body,
      sample: parsed.slice(0, 3),
    },
    null,
    2
  )
);
process.exit(nullRole === 0 && total > 0 ? 0 : nullRole > 0 ? 1 : 0);
