'use client';

/**
 * Live copy of the animated app backdrop for WebGL liquid glass.
 *
 * The glass library can only refract its root's own children, so every glass surface gets a
 * hidden "mirror" canvas that is repainted here with the backdrop layers (shader + glitter)
 * cropped to its on-screen position.
 */

interface GlassInstance {
  markChanged(element?: HTMLElement): void;
}

interface Mirror {
  canvas: HTMLCanvasElement;
  getInstance: () => GlassInstance | null;
}

const BASE_COLOR = '#040705';
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

const layers = new Map<HTMLCanvasElement, number>();
const mirrors = new Set<Mirror>();
let rafId = 0;
let lastPaint = 0;

/** Canvases covering the viewport, drawn into mirrors in ascending `order`. */
export function registerBackdropLayer(canvas: HTMLCanvasElement, order: number): () => void {
  layers.set(canvas, order);
  return () => {
    layers.delete(canvas);
  };
}

export function registerBackdropMirror(mirror: Mirror): () => void {
  mirrors.add(mirror);
  paintMirror(mirror);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => {
    mirrors.delete(mirror);
    if (mirrors.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

function loop(time: number) {
  rafId = requestAnimationFrame(loop);
  if (document.hidden || time - lastPaint < FRAME_MS) return;
  lastPaint = time;
  mirrors.forEach(paintMirror);
}

function paintMirror({ canvas, getInstance }: Mirror) {
  const rect = canvas.getBoundingClientRect();
  if (
    rect.width < 1 ||
    rect.height < 1 ||
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth
  ) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = BASE_COLOR;
  ctx.fillRect(0, 0, width, height);

  const ordered = [...layers.entries()].sort((a, b) => a[1] - b[1]);
  ordered.forEach(([layer], index) => {
    if (!layer.isConnected || layer.width === 0 || layer.height === 0) return;
    const box = layer.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    try {
      drawLayer(ctx, layer, box, rect, width / rect.width, height / rect.height, index === 0);
    } catch {
      // A layer can be mid-resize or have lost its WebGL context; skip this frame.
    }
  });

  getInstance()?.markChanged(canvas);
}

/**
 * Copies the part of `layer` under `rect`. Mirrors overhang the viewport so the glass can refract
 * past its edges; for the base layer the uncovered strips repeat the nearest edge, otherwise the
 * glass pulls a dark band in from off-screen.
 */
function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  box: DOMRect,
  rect: DOMRect,
  sx: number,
  sy: number,
  extendEdges: boolean
) {
  const left = Math.max(rect.left, box.left);
  const top = Math.max(rect.top, box.top);
  const right = Math.min(rect.right, box.right);
  const bottom = Math.min(rect.bottom, box.bottom);
  if (right - left < 1 || bottom - top < 1) return;

  const kx = layer.width / box.width;
  const ky = layer.height / box.height;
  const src = (x: number, y: number, w: number, h: number) =>
    [(x - box.left) * kx, (y - box.top) * ky, Math.max(w * kx, 1), Math.max(h * ky, 1)] as const;
  const dst = (x: number, y: number, w: number, h: number) =>
    [(x - rect.left) * sx, (y - rect.top) * sy, w * sx, h * sy] as const;

  ctx.drawImage(layer, ...src(left, top, right - left, bottom - top), ...dst(left, top, right - left, bottom - top));
  if (!extendEdges) return;

  const edge = 1;
  if (left > rect.left) {
    ctx.drawImage(layer, ...src(left, top, edge, bottom - top), ...dst(rect.left, top, left - rect.left, bottom - top));
  }
  if (right < rect.right) {
    ctx.drawImage(
      layer,
      ...src(right - edge, top, edge, bottom - top),
      ...dst(right, top, rect.right - right, bottom - top)
    );
  }
  if (top > rect.top) {
    ctx.drawImage(layer, ...src(left, top, right - left, edge), ...dst(left, rect.top, right - left, top - rect.top));
  }
  if (bottom < rect.bottom) {
    ctx.drawImage(
      layer,
      ...src(left, bottom - edge, right - left, edge),
      ...dst(left, bottom, right - left, rect.bottom - bottom)
    );
  }
}
