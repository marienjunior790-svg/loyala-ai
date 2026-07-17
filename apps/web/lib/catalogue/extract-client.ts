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

/** Extract selectable text from a PDF (digital menus) via pdf.js. */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Match the worker to the installed build to avoid version mismatches.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(doc.numPages, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }
  await doc.destroy();
  return pages.join('\n').replace(/\s+\n/g, '\n').trim();
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}
