#!/usr/bin/env node
/**
 * Submit Loyala platform WhatsApp templates to Meta Graph API.
 *
 * Requires:
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_BUSINESS_ACCOUNT_ID
 *   WHATSAPP_API_VERSION (default v21.0)
 *
 * Usage:
 *   node scripts/submit-meta-whatsapp-templates.mjs
 *   node scripts/submit-meta-whatsapp-templates.mjs loyala_inactive_v1
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const definitions = JSON.parse(
  await readFile(join(__dirname, 'data', 'meta-whatsapp-templates.json'), 'utf8')
);

const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
const version = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';
const filterName = process.argv[2]?.trim();

if (!token || !wabaId) {
  console.error('❌ Need WHATSAPP_ACCESS_TOKEN + WHATSAPP_BUSINESS_ACCOUNT_ID');
  process.exit(2);
}

const templates = filterName
  ? definitions.filter((t) => t.name === filterName)
  : definitions;

if (templates.length === 0) {
  console.error('❌ No templates matched');
  process.exit(1);
}

async function submitTemplate(def) {
  const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates`;
  const payload = {
    name: def.name,
    language: def.language,
    category: def.category,
    components: [
      {
        type: 'BODY',
        text: def.body,
        example: { body_text: def.bodyExamples },
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, json, name: def.name };
}

console.log(`Submitting ${templates.length} template(s) to WABA ${wabaId}\n`);

let failed = 0;
for (const def of templates) {
  const result = await submitTemplate(def);
  if (result.ok) {
    console.log(`✅ ${def.name} — submitted (id: ${result.json.id ?? 'pending review'})`);
  } else {
    failed += 1;
    const err = result.json?.error?.message ?? JSON.stringify(result.json).slice(0, 200);
    console.log(`❌ ${def.name} — HTTP ${result.status}: ${err}`);
  }
}

if (failed > 0) {
  console.log('\nAfter Meta approves, run:');
  console.log('  node scripts/mark-meta-templates-approved.mjs loyala_inactive_v1 ...');
  process.exit(1);
}

console.log('\n✅ Submitted. Track approval in Meta Business Manager → WhatsApp → Message templates.');
console.log('Then: node scripts/mark-meta-templates-approved.mjs');
