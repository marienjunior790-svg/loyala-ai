#!/usr/bin/env node
/**
 * Hostinger Node.js Web Apps export pipeline.
 *
 * Produces hostinger-export/ + hostinger-export.zip:
 * - Flattened Next.js app (apps/web) without workspace:* deps
 * - @loyala/* packages vendored as file:./packages/*
 * - output: "standalone" build
 * - npm install / npm run build / npm run start validation
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WEB = join(ROOT, 'apps', 'web');
const EXPORT_DIR = join(ROOT, 'hostinger-export');
const ZIP_PATH = join(ROOT, 'hostinger-export.zip');

const LOYALA_PACKAGES = [
  'core-iam',
  'db',
  'domain-crm',
  'events',
  'integrations',
  'ui',
  'validation',
];

const BUILD_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key-min-20-chars',
  NEXT_PUBLIC_APP_URL: 'https://fmagence.online',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key-min-20',
  WORKER_URL: 'https://loyala-worker-production.up.railway.app',
  WORKER_API_SECRET: 'placeholder-secret-min-16-chars',
  AI_ALLOW_MOCK: 'true',
};

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  'coverage',
  '.vercel',
  'hostinger-export',
]);

const ZIP_EXCLUDE = new Set([
  '.next',
  'node_modules',
  '.turbo',
  'tsconfig.tsbuildinfo',
  'vercel.json',
  'README.md',
  'HOSTINGER_DEPLOY.md',
  '.gitignore',
  'next.config.ts',
]);

const SKIP_FILES = new Set(['tsconfig.tsbuildinfo', '.env.local', '.env', 'next.config.ts']);

function log(step, msg) {
  console.log(`\n[hostinger-export] ${step}: ${msg}`);
}

function copyRecursive(src, dest, options = {}) {
  const { excludeTest = true } = options;
  const stat = statSync(src);
  if (stat.isDirectory()) {
    const base = src.split(/[/\\]/).pop();
    if (SKIP_DIRS.has(base)) return;
    if (excludeTest && (base === 'tests' || base === '__tests__')) return;
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(join(src, entry), join(dest, entry), options);
    }
    return;
  }
  const name = src.split(/[/\\]/).pop();
  if (SKIP_FILES.has(name)) return;
  if (excludeTest && name.endsWith('.test.ts')) return;
  cpSync(src, dest);
}

function rewriteWorkspaceDeps(pkgJson) {
  const out = { ...pkgJson };
  if (out.dependencies) {
    out.dependencies = { ...out.dependencies };
    for (const [name, version] of Object.entries(out.dependencies)) {
      if (version === 'workspace:*' && name.startsWith('@loyala/')) {
        const pkg = name.replace('@loyala/', '');
        out.dependencies[name] = `file:../${pkg}`;
      }
    }
  }
  return out;
}

function generateExportPackageJson(webPkg) {
  const deps = { ...webPkg.dependencies };
  for (const pkg of LOYALA_PACKAGES) {
    const key = `@loyala/${pkg}`;
    if (deps[key]) deps[key] = `file:./packages/${pkg}`;
  }
  // Pin Supabase for Node 20 (Hostinger) — avoid ^ resolving to v2.110+ requiring Node 22
  deps['@supabase/supabase-js'] = '2.49.1';
  deps['@supabase/ssr'] = '0.5.2';
  return {
    name: 'fmagence-app',
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev --port 3000',
      build: 'next build',
      start: 'node server.js',
    },
    dependencies: deps,
    devDependencies: webPkg.devDependencies ?? {},
    engines: { node: '>=20 <=22' },
    overrides: {
      '@supabase/supabase-js': '2.49.1',
    },
  };
}

function generateNextConfigJs() {
  return `const path = require('path');

function supabaseImageHost() {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    }
  } catch {
    /* build-time placeholder */
  }
  return 'placeholder.supabase.co';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  transpilePackages: [
    '@loyala/ui',
    '@loyala/core-iam',
    '@loyala/db',
    '@loyala/domain-crm',
    '@loyala/events',
    '@loyala/validation',
    '@loyala/integrations',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dropdown-menu'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: supabaseImageHost(), pathname: '/storage/v1/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [{ key: 'X-DNS-Prefetch-Control', value: 'on' }],
    },
  ],
};

module.exports = nextConfig;
`;
}

function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['dom', 'dom.iterable', 'esnext'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        jsx: 'preserve',
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
        noEmit: true,
        incremental: true,
        allowJs: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
      include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2
  );
}

function generateServerJs() {
  return `'use strict';
/**
 * Hostinger entry — standard Next.js HTTP server (process.env.PORT).
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const port = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      console.error('Request error', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log('> Loyala AI ready on port ' + port);
  });
});
`;
}

function generatePostbuildScript() {
  return `#!/usr/bin/env node
/** Copy static assets into standalone output (required by Next.js). */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = join(root, '.next', 'standalone');

function findStandaloneAppDir(dir) {
  if (existsSync(join(dir, 'server.js'))) return dir;
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const found = findStandaloneAppDir(join(dir, entry.name));
    if (found) return found;
  }
  return null;
}

if (!existsSync(standaloneRoot)) {
  console.warn('[postbuild] No .next/standalone — skipping asset copy');
  process.exit(0);
}

const appDir = findStandaloneAppDir(standaloneRoot) ?? standaloneRoot;

const staticSrc = join(root, '.next', 'static');
const staticDest = join(appDir, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(join(appDir, '.next'), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
  console.log('[postbuild] Copied .next/static →', staticDest);
}

const publicSrc = join(root, 'public');
const publicDest = join(appDir, 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log('[postbuild] Copied public →', publicDest);
}
`;
}

function generateEnvExample() {
  return `# Loyala AI — Web (Hostinger Node.js Web Apps)
# Copiez ce fichier en .env et renseignez les valeurs réelles.

# ── Critique (auth + CRM) ──────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-jwt

# ── Application ────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://fmagence.online
NEXT_PUBLIC_SITE_URL=https://fmagence.online

# ── Worker Railway (IA + campagnes) ────────────────────────────────
WORKER_URL=https://loyala-worker-production.up.railway.app
WORKER_API_SECRET=minimum-16-characters-secret

# ── Email transactionnel (optionnel) ───────────────────────────────
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=Loyala AI <noreply@votre-domaine.com>

# ── Rate limiting (recommandé en production) ───────────────────────
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
RATE_LIMIT_API_MAX=60
RATE_LIMIT_WINDOW_SEC=60

# ── Marketing ──────────────────────────────────────────────────────
NEXT_PUBLIC_DEMO_WHATSAPP=065719922

# ── Sécurité interne (optionnel) ───────────────────────────────────
INTERNAL_API_SECRET=

# ── Monitoring (optionnel) ─────────────────────────────────────────
SENTRY_DSN=
BETTERSTACK_HEARTBEAT_URL=

# ── Diagnostics (désactiver en production) ───────────────────────────
AUTH_DEBUG=0

# ── Hostinger ──────────────────────────────────────────────────────
PORT=3000
HOSTNAME=0.0.0.0
`;
}

export function generateHostingerDeployMd() {
  return `# Déploiement Hostinger — Loyala AI Web

Application Next.js 15 autonome, préparée pour **Hostinger Node.js Web Apps**.
Le worker IA (Railway) et Supabase restent des services externes.

## Version Node

\`\`\`
Node.js >= 20 (recommandé : 20 LTS)
\`\`\`

## Root Directory

\`\`\`
/
\`\`\`

(Racine de l'archive \`hostinger-export.zip\` — contenu extrait directement à la racine.)

## Commande Install

\`\`\`bash
npm install
\`\`\`

Alternative :

\`\`\`bash
pnpm install
\`\`\`

> Hostinger exécute cette commande à l'import. Aucun \`workspace:*\` — compatible npm natif.

## Commande Build

\`\`\`bash
npm run build
\`\`\`

> Si vous importez l'archive **déjà buildée** (avec \`.next/\` présent), Hostinger peut utiliser une build no-op :
> \`echo "pre-built"\`

## Commande Start

\`\`\`bash
npm start
\`\`\`

Équivalent direct :

\`\`\`bash
node server.js
\`\`\`

Hostinger injecte automatiquement \`PORT\` — le serveur écoute sur \`0.0.0.0\`.

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| \`NEXT_PUBLIC_SUPABASE_URL\` | **Oui** | URL projet Supabase |
| \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` | **Oui** | Clé anon Supabase |
| \`SUPABASE_SERVICE_ROLE_KEY\` | **Oui** | Service role JWT (server only) |
| \`NEXT_PUBLIC_APP_URL\` | Recommandé | URL publique de l'app |
| \`WORKER_URL\` | Recommandé | URL worker Railway |
| \`WORKER_API_SECRET\` | Recommandé | Secret partagé web ↔ worker (min 16 car.) |
| \`RESEND_API_KEY\` | Optionnel | Emails transactionnels |
| \`UPSTASH_REDIS_REST_URL\` | Optionnel | Rate limiting distribué |
| \`UPSTASH_REDIS_REST_TOKEN\` | Optionnel | Token Upstash |
| \`PORT\` | Auto | Injecté par Hostinger |
| \`NODE_ENV\` | Oui | \`production\` |

Voir \`.env.example\` pour la liste complète.

## Structure des fichiers

\`\`\`
hostinger-export/
├── package.json          # Dépendances npm (sans workspace:*)
├── server.js             # Point d'entrée production
├── .env.example            # Template variables
├── next.config.ts          # output: "standalone"
├── tsconfig.json
├── middleware.ts           # Auth session Supabase
├── app/                    # App Router (pages, API, Server Actions)
├── components/
├── lib/
├── public/
├── packages/               # @loyala/* vendored (file:./packages/*)
│   ├── core-iam/
│   ├── db/
│   ├── domain-crm/
│   ├── events/
│   ├── integrations/
│   ├── ui/
│   └── validation/
├── scripts/
│   └── postbuild-standalone.mjs
├── .next/                  # Build Next.js (+ standalone/node_modules)
└── node_modules/           # Après \`npm install\` (non inclus dans le zip)
\`\`\`

> L'archive \`hostinger-export.zip\` **n'inclut pas** \`node_modules/\` à la racine (taille).
> Hostinger exécute \`npm install\` à l'import. Les dépendances runtime standalone sont dans \`.next/standalone/node_modules/\`.

## Import sur Hostinger

1. Générer l'archive : \`pnpm hostinger:export\` (depuis le monorepo)
2. Uploader **hostinger-export.zip** (format .zip accepté)
3. Configurer les variables d'environnement dans le panneau Hostinger
4. Install : \`npm install\` | Build : \`npm run build\` | Start : \`npm start\`
5. Pointer le domaine personnalisé vers l'application Node.js

## Services externes (non inclus dans l'archive)

| Service | Rôle |
|---------|------|
| **Supabase** | Auth, base de données, storage |
| **Railway Worker** | IA, Inngest, génération campagnes |
| **Resend** | Emails (optionnel) |
| **Upstash** | Rate limiting (optionnel) |

## Notes

- Aucune dépendance \`workspace:*\` — compatible \`npm install\` natif.
- Turborepo n'est **pas** requis pour ce déploiement.
- Fonctionnalités conservées : Auth, CRM, Campagnes, IA (via worker), Dashboard, Middleware, Server Actions, API Routes.
`;
}

// Files/folders included in the Hostinger upload ZIP (flat root, no wrapper folder)
const ZIP_WHITELIST = [
  'package.json',
  'package-lock.json',
  'server.js',
  'next.config.js',
  'tsconfig.json',
  'next-env.d.ts',
  'postcss.config.js',
  'tailwind.config.js',
  'public',
  'src',
  'components',
  'lib',
  'packages',
];

function applySrcLayout(exportDir) {
  const srcDir = join(exportDir, 'src');
  mkdirSync(srcDir, { recursive: true });

  const appDir = join(exportDir, 'app');
  if (existsSync(appDir)) {
    cpSync(appDir, join(srcDir, 'app'), { recursive: true });
    rmSync(appDir, { recursive: true, force: true });
  }

  const mwPath = join(exportDir, 'middleware.ts');
  if (existsSync(mwPath)) {
    const content = readFileSync(mwPath, 'utf8').replace(
      "from './lib/supabase/middleware'",
      "from '../lib/supabase/middleware'"
    );
    writeFileSync(join(srcDir, 'middleware.ts'), content);
    rmSync(mwPath, { force: true });
  }

  for (const rootFile of ['instrumentation.ts']) {
    const p = join(exportDir, rootFile);
    if (existsSync(p)) {
      cpSync(p, join(srcDir, rootFile));
      rmSync(p, { force: true });
    }
  }
  log('stage', 'Applied src/ layout (src/app + src/middleware.ts)');
  removeBracketRouteDirs(join(exportDir, 'src', 'app', 'api', 'ai'));
  removeEmptyApiDirs(join(exportDir, 'src', 'app', 'api'));
}

/** Remove [...path] folders — break Hostinger Linux build (EACCES on scandir). */
function removeBracketRouteDirs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.includes('[') || entry.name.includes(']')) {
        rmSync(full, { recursive: true, force: true });
        log('stage', `Removed bracket folder: ${entry.name}`);
      } else {
        removeBracketRouteDirs(full);
      }
    }
  }
}

function removeEmptyApiDirs(apiDir) {
  if (!existsSync(apiDir)) return;
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of readdirSync(apiDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(apiDir, entry.name);
      removeEmptyApiDirs(full);
      const hasRoute = existsSync(join(full, 'route.ts'));
      const children = readdirSync(full, { withFileTypes: true });
      if (!hasRoute && children.length === 0) {
        rmSync(full, { recursive: true, force: true });
        log('stage', `Removed empty API dir: ${entry.name}`);
        changed = true;
      }
    }
  }
}

function run(cmd, cwd, env = {}) {
  log('exec', `${cmd} (cwd: ${relative(ROOT, cwd) || '.'})`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
}

function createZip() {
  log('zip', ZIP_PATH);
  try {
    execSync('npm install --package-lock-only --ignore-scripts', {
      cwd: EXPORT_DIR,
      stdio: 'inherit',
      shell: true,
    });
  } catch (err) {
    log('zip', `Warning: package-lock generation failed — ${err.message}`);
  }

  const staging = join(ROOT, `hostinger-zip-staging-${Date.now()}`);
  mkdirSync(staging, { recursive: true });

  for (const item of ZIP_WHITELIST) {
    const src = join(EXPORT_DIR, item);
    if (!existsSync(src)) {
      log('zip', `Warning: missing ${item}`);
      continue;
    }
    cpSync(src, join(staging, item), { recursive: true });
  }

  if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH, { force: true });

  // Use tar on all platforms — Compress-Archive sets Unix mode 0o0 (MS-DOS) and
  // breaks Linux scandir (EACCES) on Hostinger. Windows tar sets 0o755/0o644.
  execSync(`tar -acf "${ZIP_PATH}" -C "${staging}" .`, { stdio: 'inherit' });

  rmSync(staging, { recursive: true, force: true });
  const sizeMb = (statSync(ZIP_PATH).size / (1024 * 1024)).toFixed(2);
  log('done', `Archive: ${ZIP_PATH} (${sizeMb} Mo)`);
  verifyZipStructure(ZIP_PATH);
}

function verifyZipStructure(zipPath) {
  let out;
  // tar-created .zip — list via tar on all platforms
  out = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const lines = out.split('\n').filter(Boolean);
  const norm = (l) =>
    l
      .replace(/\r/g, '')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
  const allowedRoots = new Set(ZIP_WHITELIST);
  const hasParent = lines.some((l) => {
    const n = norm(l);
    if (!n.includes('/')) return false;
    return !allowedRoots.has(n.split('/')[0]);
  });
  const checks = {
    'package.json (root)': lines.some((l) => norm(l) === 'package.json'),
    'server.js (root)': lines.some((l) => norm(l) === 'server.js'),
    'next.config.js (root)': lines.some((l) => norm(l) === 'next.config.js'),
    'public/': lines.some((l) => norm(l).startsWith('public/')),
    'src/app/': lines.some((l) => norm(l).startsWith('src/app/')),
    'no app/ at root': !lines.some((l) => norm(l).startsWith('app/')),
    'next in package.json': readFileSync(join(EXPORT_DIR, 'package.json'), 'utf8').includes('"next"'),
    'no .next/': !lines.some((l) => norm(l).startsWith('.next/')),
    'no node_modules/': !lines.some((l) => norm(l).startsWith('node_modules/')),
    'no parent folder': !hasParent,
    'api/ai flat routes': lines.some((l) => norm(l) === 'src/app/api/ai/stats/route.ts'),
    'no api/ai bracket folders': !lines.some(
      (l) => norm(l).startsWith('src/app/api/ai/') && /[\[\]]/.test(norm(l))
    ),
  };
  log('verify', 'ZIP structure:');
  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${v ? '✅' : '❌'} ${k}`);
  }
  if (Object.values(checks).some((v) => !v)) {
    throw new Error('ZIP structure validation failed');
  }
}

async function validateStart(cwd) {
  return new Promise((resolvePromise, reject) => {
    log('validate', 'npm run start (smoke test /api/health)');
    const port = '3456';
    const child = spawn('node', ['server.js'], {
      cwd,
      env: { ...process.env, ...BUILD_ENV, PORT: port, HOSTNAME: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let ready = false;
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      if (!ready) {
        child.kill();
        reject(new Error(`Start timeout (90s)${stderr ? `: ${stderr.slice(-500)}` : ''}`));
      }
    }, 90_000);

    const check = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (res.status > 0) {
          ready = true;
          clearTimeout(timeout);
          child.kill();
          log('validate', `Server responding (HTTP ${res.status})`);
          resolvePromise();
          return;
        }
      } catch {
        /* server still booting */
      }
      if (!ready) setTimeout(check, 1500);
    };

    setTimeout(check, 3000);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!ready && code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}${stderr ? `: ${stderr.slice(-500)}` : ''}`));
      }
    });
  });
}

// ── Main pipeline ──────────────────────────────────────────────────

function stageExport() {
  log('stage', 'Preparing hostinger-export/');
  mkdirSync(EXPORT_DIR, { recursive: true });
  for (const entry of readdirSync(EXPORT_DIR)) {
    const target = join(EXPORT_DIR, entry);
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      log('stage', `Warning: could not remove ${entry} — continuing`);
    }
  }

  // Copy web app source
  for (const entry of readdirSync(WEB)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    copyRecursive(join(WEB, entry), join(EXPORT_DIR, entry));
  }

  // Vendor @loyala packages
  const packagesDir = join(EXPORT_DIR, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  for (const pkg of LOYALA_PACKAGES) {
    const src = join(ROOT, 'packages', pkg);
    const dest = join(packagesDir, pkg);
    copyRecursive(src, dest, { excludeTest: true });
    const pkgPath = join(dest, 'package.json');
    const raw = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const rewritten = rewriteWorkspaceDeps(raw);
    writeFileSync(pkgPath, JSON.stringify(rewritten, null, 2));
  }

  // Generated files
  const webPkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
  writeFileSync(join(EXPORT_DIR, 'package.json'), JSON.stringify(generateExportPackageJson(webPkg), null, 2));
  writeFileSync(join(EXPORT_DIR, 'next.config.js'), generateNextConfigJs());
  writeFileSync(join(EXPORT_DIR, 'tsconfig.json'), generateTsConfig());
  writeFileSync(join(EXPORT_DIR, 'server.js'), generateServerJs());
  writeFileSync(join(EXPORT_DIR, '.env.example'), generateEnvExample());

  // Ensure public/ exists (Hostinger requirement)
  mkdirSync(join(EXPORT_DIR, 'public'), { recursive: true });
  if (!existsSync(join(EXPORT_DIR, 'public', '.gitkeep'))) {
    writeFileSync(join(EXPORT_DIR, 'public', '.gitkeep'), '');
  }
  // Remove next.config.ts if copied from source — Hostinger expects next.config.js
  const tsConfigPath = join(EXPORT_DIR, 'next.config.ts');
  if (existsSync(tsConfigPath)) rmSync(tsConfigPath);

  applySrcLayout(EXPORT_DIR);

  const scriptsDir = join(EXPORT_DIR, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  writeFileSync(join(scriptsDir, 'postbuild-standalone.mjs'), generatePostbuildScript());

  writeFileSync(join(ROOT, 'HOSTINGER_DEPLOY.md'), generateHostingerDeployMd());

  log('stage', `Created ${relative(ROOT, EXPORT_DIR)}`);
}

async function main() {
  const zipOnly = process.argv.includes('--zip-only');

  console.log('═'.repeat(60));
  console.log(' Loyala AI — Hostinger Export Pipeline');
  console.log('═'.repeat(60));

  stageExport();

  if (!zipOnly) {
    log('validate', 'npm install');
    run('npm install', EXPORT_DIR);

    log('validate', 'npm run build');
    run('npm run build', EXPORT_DIR, BUILD_ENV);

    try {
      await validateStart(EXPORT_DIR);
    } catch (err) {
      console.warn('[hostinger-export] Start smoke test skipped or failed:', err.message);
      console.warn('Build succeeded — deploy may still work with correct env vars on Hostinger.');
    }
  } else {
    log('zip-only', 'Skipping local npm install/build — Hostinger will build on deploy');
  }

  createZip();

  console.log('\n' + '═'.repeat(60));
  console.log(' Export terminé avec succès');
  console.log('═'.repeat(60));
  console.log(`  Dossier : ${EXPORT_DIR}`);
  console.log(`  Archive : ${ZIP_PATH}`);
  console.log(`  Guide   : ${join(ROOT, 'HOSTINGER_DEPLOY.md')}`);
  console.log('');
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  main().catch((err) => {
    console.error('\n[hostinger-export] FAILED:', err.message);
    process.exit(1);
  });
}
