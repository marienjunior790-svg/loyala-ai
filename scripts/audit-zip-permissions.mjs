#!/usr/bin/env node
/** Audit ZIP Unix permissions for api/ai entries (Hostinger EACCES diagnosis). */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const zip = join(dirname(fileURLToPath(import.meta.url)), '..', 'hostinger-export.zip');

const ps = `
Add-Type -AssemblyName System.IO.Compression
$zip = [System.IO.Compression.ZipFile]::OpenRead('${zip.replace(/'/g, "''")}')
foreach ($e in $zip.Entries) {
  if ($e.FullName -notmatch 'src/app/api/ai') { continue }
  $ext = $e.ExternalFileAttributes
  $unix = ($ext -shr 16) -band 0xFFFF
  $mode = '{0:x4}' -f $unix
  $type = if ($e.FullName.EndsWith('/')) { 'DIR' } else { 'FILE' }
  Write-Output "$type|$mode|$($e.FullName)"
}
$zip.Dispose()
`;

const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

console.log('ZIP api/ai permission audit (unix mode from ExternalFileAttributes):');
console.log('type | mode | path');
for (const line of out.split(/\r?\n/).filter(Boolean)) {
  console.log(line);
}

const modes = out.split(/\r?\n/).filter(Boolean).map((l) => l.split('|')[1]);
const bad = modes.filter((m) => m && parseInt(m, 16) !== 0 && (parseInt(m, 16) & 0o444) === 0);
console.log('\nEntries with no read bit for owner/group/other:', bad.length);
