#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const zip = join(dirname(fileURLToPath(import.meta.url)), '..', 'hostinger-export.zip');
const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${zip.replace(/'/g, "''")}')
$z.Entries | ForEach-Object { $_.FullName }
$z.Dispose()
`;
const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
const lines = out.split(/\r?\n/).filter(Boolean);
console.log('Total entries:', lines.length);
const ai = lines.filter((l) => l.replace(/\\/g, '/').includes('api/ai'));
console.log('api/ai entries:', ai.length);
ai.slice(0, 20).forEach((l) => console.log(' ', l));
const sample = lines.filter((l) => l.includes('src')).slice(0, 15);
console.log('Sample src entries:');
sample.forEach((l) => console.log(' ', l));
