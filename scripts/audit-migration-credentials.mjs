#!/usr/bin/env node
/** Presence-only audit for migration credentials (never prints values). */
const keys = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
];
const report = {};
for (const key of keys) {
  const value = process.env[key];
  report[key] = {
    set: Boolean(value),
    length: value ? value.length : 0,
  };
}
console.log(JSON.stringify(report, null, 2));
process.exit(
  report.DATABASE_URL?.set || report.SUPABASE_ACCESS_TOKEN?.set ? 0 : 2
);
