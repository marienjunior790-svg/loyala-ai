#!/usr/bin/env node
/** List applied Loyala migrations via REST (if table readable). */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const res = await fetch(`${base}/rest/v1/_loyala_migrations?select=name,applied_at&order=applied_at.asc`, {
  headers,
});
const text = await res.text();
if (!res.ok) {
  console.log('status', res.status, text.slice(0, 400));
  process.exit(1);
}
const rows = JSON.parse(text);
console.log(JSON.stringify({ count: rows.length, migrations: rows }, null, 2));
