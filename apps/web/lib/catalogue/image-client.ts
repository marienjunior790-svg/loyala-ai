/**
 * Client-side image optimization for catalog product images.
 * Runs in the browser: resize + re-encode to WebP (fallback JPEG) before upload.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export interface CompressOptions {
  maxSide?: number;
  quality?: number;
}

/**
 * Compress/resize an image (File or data URL) to an optimized WebP data URL.
 * Falls back to JPEG when the browser cannot encode WebP.
 */
export async function compressImageToWebp(
  source: File | string,
  options: CompressOptions = {}
): Promise<string> {
  const maxSide = options.maxSide ?? 1024;
  const quality = options.quality ?? 0.82;

  const dataUrl = typeof source === 'string' ? source : await readAsDataUrl(source);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', quality);
}
