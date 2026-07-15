#!/usr/bin/env node
/**
 * Apply repair objects that don't need DATABASE_URL (Storage bucket via REST).
 * SQL repair still requires DATABASE_URL or SUPABASE_ACCESS_TOKEN.
 */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function ensureBucket() {
  const get = await fetch(`${base}/storage/v1/bucket/org-assets`, { headers });
  if (get.ok) {
    console.log('bucket org-assets: already exists');
    return true;
  }
  const create = await fetch(`${base}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 'org-assets', name: 'org-assets', public: true }),
  });
  const text = await create.text();
  if (create.ok || text.includes('already exists')) {
    console.log('bucket org-assets: created or exists');
    return true;
  }
  console.error('bucket org-assets: failed', create.status, text.slice(0, 200));
  return false;
}

const ok = await ensureBucket();
process.exit(ok ? 0 : 1);
