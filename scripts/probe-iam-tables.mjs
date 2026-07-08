#!/usr/bin/env node
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };
for (const q of [
  'roles?select=code,id,scope&limit=20',
  'organization_members?select=user_id,role_id,status&limit=10',
  'organizations?select=id,name&limit=5',
]) {
  const res = await fetch(`${base}/rest/v1/${q}`, { headers: h });
  const t = await res.text();
  console.log(q, res.status, t.slice(0, 400));
}
