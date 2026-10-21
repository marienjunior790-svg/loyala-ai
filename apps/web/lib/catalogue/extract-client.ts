/**
 * Client-side extractors for intelligent catalog imports.
 * Everything here runs in the browser only (dynamic imports keep the
 * heavy libraries out of the server bundle).
 */

/** Read a File as a base64 data URL (used for image / vision imports). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

/** Extract plain text from a spreadsheet (.xlsx/.xls/.csv) via SheetJS. */
export async function spreadsheetToText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  return wb.SheetNames.map((name) => XLSX.utils.sheet_to_csv(wb.Sheets[name]!)).join('\n');
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // Prefer same-origin worker (copied to /public) — CDN often blocked on mobile.
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
  }
  return pdfjs;
}

/** Extract selectable text from a PDF (digital menus) via pdf.js. */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const pages: string[] = [];
    const maxPages = Math.min(doc.numPages, 20);
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      pages.push(text);
    }
    return pages.join('\n').replace(/\s+\n/g, '\n').trim();
  } finally {
    await doc.destroy();
  }
}

/**
 * Rasterize PDF pages to JPEG data URLs for Vision/OCR when the PDF has no
 * selectable text (scanned menus).
 */
export async function pdfToImages(file: File, maxPages = 4): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const images: string[] = [];
    const limit = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
    }
    return images;
  } finally {
    await doc.destroy();
  }
}

/** Decode a QR code from an image file → returns the encoded text (often a URL). */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const [{ default: jsQR }] = await Promise.all([import('jsqr')]);
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const result = jsQR(imageData.data, w, h);
  return result?.data ?? null;
}

/** Turn WordprocessingML into plain text. */
export function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  await writer.write(copy);
  await writer.close();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function readZipEntry(buffer: ArrayBuffer, entryName: string): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  const scanFrom = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= scanFrom; i--) {
    if (readU32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entryCount = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  for (let n = 0; n < entryCount; n++) {
    if (readU32(bytes, cursor) !== 0x02014b50) return null;
    const method = readU16(bytes, cursor + 10);
    const compressedSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === entryName) {
      const localNameLength = readU16(bytes, localOffset + 26);
      const localExtraLength = readU16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRaw(compressed);
      return null;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** Extract the visible text of a .docx menu. */
export async function docxToText(file: File): Promise<string> {
  const xmlBytes = await readZipEntry(await file.arrayBuffer(), 'word/document.xml');
  if (!xmlBytes) {
    throw new Error('Ce fichier Word ne contient pas de texte lisible.');
  }
  const text = docxXmlToText(new TextDecoder().decode(xmlBytes));
  if (text.length < 10) {
    throw new Error('Ce fichier Word est vide ou ne contient pas de texte.');
  }
  return text;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}
