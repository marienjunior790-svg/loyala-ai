#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const zip = join(dirname(fileURLToPath(import.meta.url)), '..', 'hostinger-export.zip');
if (!existsSync(zip)) {
  console.error('Missing hostinger-export.zip');
  process.exit(1);
}

const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${zip.replace(/'/g, "''")}')
$z.Entries | Where-Object { $_.FullName -like 'src/app/api/ai*' } | ForEach-Object { $_.FullName }
$z.Dispose()
`;

const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

const lines = out.split(/\r?\n/).filter(Boolean);
console.log(`ZIP api/ai entries: ${lines.length}`);
for (const l of lines.sort()) console.log(' ', l);
const hasBracket = lines.some((l) => /[\[\]]/.test(l));
console.log(hasBracket ? 'FAIL: bracket folders present' : 'OK: no bracket folders in api/ai');
