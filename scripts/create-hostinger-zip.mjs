#!/usr/bin/env node
/** Regenerate HOSTINGER_DEPLOY.md and hostinger-export.zip without full rebuild */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { generateHostingerDeployMd } from './hostinger-export.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EXPORT_DIR = join(ROOT, 'hostinger-export');
const ZIP_PATH = join(ROOT, 'hostinger-export.zip');
const ZIP_TMP = join(ROOT, 'hostinger-export-new.zip');

writeFileSync(join(ROOT, 'HOSTINGER_DEPLOY.md'), generateHostingerDeployMd());
cpSync(join(ROOT, 'HOSTINGER_DEPLOY.md'), join(EXPORT_DIR, 'HOSTINGER_DEPLOY.md'));

console.log('Updated HOSTINGER_DEPLOY.md');

const exclude = ['.turbo', 'tsconfig.tsbuildinfo', 'node_modules'];

const staging = join(ROOT, `hostinger-export-staging-${Date.now()}`);
if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

for (const entry of readdirSync(EXPORT_DIR)) {
  if (exclude.includes(entry)) continue;
  cpSync(join(EXPORT_DIR, entry), join(staging, entry), { recursive: true });
}

const ps = process.platform === 'win32'
  ? `tar -a -cf "${ZIP_TMP.replace(/\\/g, '/')}" -C "${staging.replace(/\\/g, '/')}" .`
  : `tar -czf "${ZIP_TMP}" -C "${staging}" .`;
execSync(ps, { stdio: 'inherit', shell: true });
rmSync(staging, { recursive: true, force: true });

let finalZip = ZIP_TMP;
try {
  if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
  renameSync(ZIP_TMP, ZIP_PATH);
  finalZip = ZIP_PATH;
} catch {
  console.warn(`Could not replace ${ZIP_PATH} — using ${ZIP_TMP}`);
}
const sizeMb = (statSync(finalZip).size / (1024 * 1024)).toFixed(2);
console.log(`Created ${finalZip} (${sizeMb} Mo)`);
