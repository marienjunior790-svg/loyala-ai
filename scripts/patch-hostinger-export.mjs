#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EXPORT = join(ROOT, 'hostinger-export');
const WEB = join(ROOT, 'apps/web');

let nc = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
nc = nc.replace(
  /const monorepoRoot = path\.join\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.\/\.\.'\);/,
  "const appRoot = path.dirname(fileURLToPath(import.meta.url));"
);
nc = nc.replace(/\s*outputFileTracingRoot: monorepoRoot,/, '\n  outputFileTracingRoot: appRoot,');
writeFileSync(join(EXPORT, 'next.config.ts'), nc);

const script = readFileSync(join(ROOT, 'scripts/hostinger-export.mjs'), 'utf8');
const serverMatch = script.match(/function generateServerJs\(\) \{\s*return `([\s\S]*?)`;\s*\}/);
const postMatch = script.match(/function generatePostbuildScript\(\) \{\s*return `([\s\S]*?)`;\s*\}/);
writeFileSync(join(EXPORT, 'server.js'), serverMatch[1]);
mkdirSync(join(EXPORT, 'scripts'), { recursive: true });
writeFileSync(join(EXPORT, 'scripts/postbuild-standalone.mjs'), postMatch[1]);
console.log('Patched hostinger-export files');
