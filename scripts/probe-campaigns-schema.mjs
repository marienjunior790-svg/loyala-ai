#!/usr/bin/env node
/** Probe campaigns schema + RLS via DATABASE_URL. Never logs secrets. */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('NO_DATABASE_URL');
  process.exit(2);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const queries = {
  campaigns_exists: `
    SELECT to_regclass('public.campaigns') IS NOT NULL AS exists
  `,
  columns: `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns'
    ORDER BY ordinal_position
  `,
  policies: `
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns'
  `,
  user_org_ids_fns: `
    SELECT n.nspname AS schema, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'user_org_ids'
  `,
  campaigns_grants: `
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'campaigns'
    ORDER BY grantee, privilege_type
  `,
};

for (const [name, sql] of Object.entries(queries)) {
  try {
    const { rows } = await client.query(sql);
    console.log(`\n## ${name}`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log(`\n## ${name} ERROR`);
    console.log(e instanceof Error ? e.message : String(e));
  }
}

await client.end();
