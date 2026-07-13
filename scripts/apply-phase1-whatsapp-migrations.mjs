#!/usr/bin/env node
/**
 * Apply Phase 1 WhatsApp migrations in order: 020 → 024.
 * Requires DATABASE_URL or SUPABASE_ACCESS_TOKEN.
 *
 * Usage: pnpm db:apply-phase1-whatsapp
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const FILES = [
  '020_production_full_schema_alignment.sql',
  '021_client_visits.sql',
  '022_whatsapp_messages.sql',
  '023_conversation_sessions.sql',
  '024_message_template_catalog.sql',
];

if (!process.env.DATABASE_URL && !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('Need DATABASE_URL or SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

for (const file of FILES) {
  console.log(`\n=== Applying ${file} ===`);
  const result = spawnSync(
    process.execPath,
    [join(__dirname, 'apply-migration-file.mjs'), file],
    { cwd: root, env: process.env, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(`Failed on ${file} (exit ${result.status ?? 'null'})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n=== Phase 1 migrations applied. Verify with: ===');
console.log('  pnpm db:verify-022');
console.log('  pnpm db:verify-023');
console.log('  pnpm db:verify-024');
