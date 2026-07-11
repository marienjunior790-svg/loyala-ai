#!/usr/bin/env node
/** Generate flat /api/ai/* route.ts files (no [...path] brackets — Hostinger-safe). */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const PATHS = [
  'stats',
  'segment',
  'inactive/detect',
  'inactive/analyze',
  'campaigns/birthday',
  'campaigns/loyalty',
  'campaigns/promotions',
  'inbox/reply',
  'inbox/classify',
  'rfm/score',
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AI_ROOT = join(ROOT, 'apps', 'web', 'app', 'api', 'ai');

function writeRoute(subPath) {
  const segments = subPath.split('/');
  const routeDir = join(AI_ROOT, ...segments);
  mkdirSync(routeDir, { recursive: true });
  const sharedImport = `${'../'.repeat(segments.length)}_shared`;
  const content = `import { handleAiProxyForPath } from '${sharedImport}';

const SUB_PATH = '${subPath}' as const;

export async function GET(request: Request) {
  return handleAiProxyForPath(request, SUB_PATH);
}

export async function POST(request: Request) {
  return handleAiProxyForPath(request, SUB_PATH);
}
`;
  writeFileSync(join(routeDir, 'route.ts'), content);
}

const catchAll = join(AI_ROOT, '[...path]');
if (existsSync(catchAll)) {
  rmSync(catchAll, { recursive: true, force: true });
  console.log('Removed [...path] catch-all route');
}

for (const p of PATHS) {
  writeRoute(p);
}

console.log(`Generated ${PATHS.length} AI routes under apps/web/app/api/ai/`);
