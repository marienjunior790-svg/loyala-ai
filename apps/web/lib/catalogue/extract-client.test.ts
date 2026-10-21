import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { docxToText, docxXmlToText } from './extract-client';

function u16(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function zipWithDeflatedEntry(name: string, content: string): Uint8Array {
  const data = Buffer.from(content);
  const compressed = deflateRawSync(data);
  const nameBytes = Buffer.from(name);
  const local = Buffer.concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(0),
    u32(compressed.length),
    u32(data.length),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
    compressed,
  ]);
  const central = Buffer.concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(0),
    u32(compressed.length),
    u32(data.length),
    u16(nameBytes.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    nameBytes,
  ]);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(central.length),
    u32(local.length),
    u16(0),
  ]);
  return new Uint8Array(Buffer.concat([local, central, end]));
}

describe('docxXmlToText', () => {
  it('conserve les paragraphes d’une carte Word', () => {
    const text = docxXmlToText(
      '<w:document><w:p><w:r><w:t>Poulet braisé</w:t></w:r></w:p><w:p><w:r><w:t>4500</w:t></w:r></w:p></w:document>'
    );
    expect(text).toBe('Poulet braisé\n4500');
  });
});

describe('docxToText', () => {
  it('lit le document.xml d’un fichier .docx', async () => {
    const bytes = zipWithDeflatedEntry(
      'word/document.xml',
      '<w:document><w:p><w:r><w:t>Nems x4 — 2500</w:t></w:r></w:p></w:document>'
    );
    const file = new File([bytes], 'Carte_des_menus.docx');
    await expect(docxToText(file)).resolves.toBe('Nems x4 — 2500');
  });
});
