#!/usr/bin/env node
/** Probe Inngest endpoint reachability (no secrets logged). */
const base = process.argv[2] ?? 'https://loyala-worker-production.up.railway.app';

for (const method of ['GET', 'PUT']) {
  const res = await fetch(`${base}/api/inngest`, { method });
  const text = await res.text();
  console.log(`${method} ${res.status}`, text.slice(0, 200));
}
