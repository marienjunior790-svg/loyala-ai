#!/usr/bin/env node
/**
 * Mark platform templates as approved in message_template_catalog (after Meta review).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/mark-meta-templates-approved.mjs
 *   DATABASE_URL=... node scripts/mark-meta-templates-approved.mjs loyala_inactive_v1 loyala_birthday_v1
 */
import pg from 'pg';

const names =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ['loyala_birthday_v1', 'loyala_inactive_v1', 'loyala_loyalty_v1', 'loyala_promo_v1'];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Need DATABASE_URL');
  process.exit(2);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rowCount } = await client.query(
  `UPDATE message_template_catalog
   SET status = 'approved', approved_at = now(), updated_at = now()
   WHERE channel = 'whatsapp'
     AND organization_id IS NULL
     AND provider_template_name = ANY($1::text[])`,
  [names]
);

await client.end();

console.log(`✅ Marked ${rowCount} template(s) approved: ${names.join(', ')}`);
console.log('Worker will load these from DB on next campaign auto-send.');
