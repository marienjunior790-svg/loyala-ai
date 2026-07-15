#!/usr/bin/env node
/**
 * Verify Upstash Redis connectivity for distributed rate limiting.
 * Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from .env.ops.local
 * or process environment.
 */
import { existsSync, readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  if (existsSync('.env.ops.local')) {
    for (const line of readFileSync('.env.ops.local', 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) env[t.slice(0, eq).trim()] = v;
    }
  }
  return env;
}

const env = loadEnv();
const baseUrl = env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const token = env.UPSTASH_REDIS_REST_TOKEN;

if (!baseUrl || !token) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  console.error('   Create a free Redis database at https://console.upstash.com');
  console.error('   Add both vars to .env.ops.local and Vercel (Production).');
  process.exit(2);
}

const probeKey = `loyala:rl:probe:${Date.now()}`;

async function cmd(command, ...args) {
  const path = [command, ...args.map((a) => encodeURIComponent(a))].join('/');
  const res = await fetch(`${baseUrl}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

console.log('Probing Upstash Redis REST API...\n');

const ping = await cmd('ping');
if (!ping.ok) {
  console.error(`❌ PING failed HTTP ${ping.status}: ${ping.text.slice(0, 200)}`);
  process.exit(1);
}
console.log('✅ PING ok');

const incr = await cmd('incr', probeKey);
if (!incr.ok) {
  console.error(`❌ INCR failed HTTP ${incr.status}`);
  process.exit(1);
}
console.log(`✅ INCR ok (count=${incr.text.trim()})`);

const expire = await cmd('expire', probeKey, '30');
if (!expire.ok) {
  console.error(`❌ EXPIRE failed HTTP ${expire.status}`);
  process.exit(1);
}
console.log('✅ EXPIRE ok');

const del = await cmd('del', probeKey);
if (!del.ok) {
  console.error(`❌ DEL failed HTTP ${del.status}`);
  process.exit(1);
}
console.log('✅ DEL ok');

console.log('\n✅ Upstash ready for Vercel production rate limiting.');
console.log('   Add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to Vercel → Production.');
