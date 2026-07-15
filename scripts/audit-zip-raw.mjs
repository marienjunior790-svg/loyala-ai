#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const zipPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'hostinger-export.zip');
const buf = readFileSync(zipPath);

function findEntries() {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig === 0x06054b50) break; // end of central directory
    if (sig !== 0x04034b50) break; // local file header
    const compMethod = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    entries.push({ name, compMethod, compSize, dataStart });
    offset = dataStart + compSize;
  }
  return entries;
}

const entries = findEntries().filter((e) => e.name.includes('src/app/api/ai'));
console.log('Local file header entries for api/ai:', entries.length);
for (const e of entries) {
  console.log(e.name);
}
const brackets = entries.filter((e) => /[\[\]]/.test(e.name));
console.log('Bracket entries:', brackets.length, brackets.map((e) => e.name));
