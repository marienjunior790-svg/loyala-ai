#!/usr/bin/env node
/** Quick smoke test for hostinger-export server.js */
import { spawn } from 'child_process';

const BUILD_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key-min-20-chars',
  NEXT_PUBLIC_APP_URL: 'https://fmagence.online',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key-min-20',
  WORKER_URL: 'https://loyala-worker-production.up.railway.app',
  WORKER_API_SECRET: 'placeholder-secret-min-16-chars',
  AI_ALLOW_MOCK: 'true',
  PORT: '3456',
  HOSTNAME: '127.0.0.1',
};

const cwd = new URL('../hostinger-export/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const child = spawn('node', ['server.js'], {
  cwd,
  env: { ...process.env, ...BUILD_ENV },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr?.on('data', (c) => { stderr += c; });

const timeout = setTimeout(() => {
  child.kill();
  console.error('TIMEOUT', stderr.slice(-500));
  process.exit(1);
}, 90000);

async function check() {
  try {
    const res = await fetch('http://127.0.0.1:3456/api/health');
    if (res.status > 0) {
      console.log('Server responding HTTP', res.status);
      clearTimeout(timeout);
      child.kill();
      process.exit(0);
    }
  } catch { /* retry */ }
  setTimeout(check, 1500);
}

setTimeout(check, 3000);
child.on('exit', (code) => {
  if (code !== null && code !== 0) {
    clearTimeout(timeout);
    console.error('Exit', code, stderr.slice(-500));
    process.exit(1);
  }
});
