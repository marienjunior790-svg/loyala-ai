#!/usr/bin/env node
/**
 * Static validation of auth/session RSC fix (local working tree).
 * Run: node scripts/validate-auth-fix.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps/web');

function read(rel) {
  return readFileSync(join(web, rel), 'utf8');
}

const checks = [];
function pass(name) {
  checks.push({ name, ok: true });
}
function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

const session = read('lib/auth/session.ts');
const guard = read('lib/auth/guard.ts');
const middleware = read('lib/supabase/middleware.ts');
const debug = read('lib/auth/debug.ts');

// Fix 1: org from getActiveMembership, not cookie-first
if (/let organizationId = cookieStore\.get\(ORG_COOKIE_NAME\)/.test(session)) {
  fail('session.ts org resolution', 'Still uses cookie-first organizationId assignment');
} else if (/const active = await getActiveMembership\(supabase\)/.test(session)) {
  pass('session.ts resolves org via getActiveMembership');
} else {
  fail('session.ts org resolution', 'getActiveMembership not found in getAuthContext');
}

// Fix 2: React cache on getSession/getAuthContext
if (/export const getSession = cache\(/.test(session)) pass('session.ts getSession cached');
else fail('session.ts cache', 'getSession not wrapped in cache()');

if (/export const getAuthContext = cache\(/.test(session)) pass('session.ts getAuthContext cached');
else fail('session.ts cache', 'getAuthContext not wrapped in cache()');

// Fix 3: guard differentiates login vs onboarding, never redirects to /dashboard
if (/redirect\('\/onboarding'\)/.test(guard) && /redirect_onboarding|no_membership|hasMembership: false/.test(guard)) {
  pass('guard.ts onboarding redirect for authenticated user without org');
} else {
  fail('guard.ts redirects', 'Missing /onboarding redirect for no-membership case');
}

if (/redirect\('\/dashboard'\)/.test(guard)) {
  fail('guard.ts dashboard redirect', 'guard.ts must not redirect to /dashboard');
} else {
  pass('guard.ts no redirect to /dashboard');
}

if (/if \(!ctx\) redirect\('\/login'\)/.test(guard)) {
  fail('guard.ts login redirect', 'Still redirects to /login when ctx is null without checking session');
} else {
  pass('guard.ts no blind redirect to login on null ctx');
}

// Fix 4: middleware resyncs stale org cookie
const staleSync = /orgCookie !== membership\.organization_id/.test(middleware);
if (staleSync) pass('middleware.ts stale org cookie resync');
else fail('middleware.ts cookie sync', 'Does not resync when orgCookie !== membership.organization_id');

// Fix 5: AUTH_DEBUG instrumentation
if (/AUTH_DEBUG/.test(debug) && /authDebug\('getSession'/.test(session)) {
  pass('AUTH_DEBUG instrumentation present');
} else {
  fail('AUTH_DEBUG', 'Missing debug hooks');
}

// Security: no token leakage in debug logs
const debugSources = [session, guard, debug].join('\n');
if (/access_token|refresh_token|sb-.*token/i.test(debugSources)) {
  fail('security', 'Possible token leakage in auth debug logs');
} else {
  pass('debug logs do not include raw tokens');
}

// Regression: cookie still read only for diagnostics
if (/organizationId = orgCookie/.test(session) || /organizationId = cookieStore/.test(session)) {
  fail('session.ts stale logic', 'organizationId still assigned from cookie');
} else {
  pass('session.ts cookie not used as org source of truth');
}

console.log('\n=== Auth fix validation (local working tree) ===\n');
let failed = 0;
for (const c of checks) {
  const icon = c.ok ? 'PASS' : 'FAIL';
  console.log(`${icon}  ${c.name}${c.detail ? `\n       → ${c.detail}` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed\n`);
process.exit(failed ? 1 : 0);
