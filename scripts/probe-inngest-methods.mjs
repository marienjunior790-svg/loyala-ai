#!/usr/bin/env node
/** Probe GET/POST/PUT on Railway Inngest endpoint (no secrets). */
const base = process.argv[2] ?? 'https://loyala-worker-production.up.railway.app/api/inngest';

const cases = [
  { method: 'GET', headers: {} },
  { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' }, body: '{}' },
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-inngest-signature': 't=0&s=invalid' }, body: '{}' },
];

for (const c of cases) {
  const res = await fetch(base, {
    method: c.method,
    headers: c.headers,
    body: c.body,
  });
  const text = await res.text();
  let message = text.slice(0, 120);
  try {
    message = JSON.parse(text).message ?? JSON.parse(text).error ?? message;
  } catch {
    /* plain */
  }
  console.log(JSON.stringify({ method: c.method, status: res.status, message }));
}
