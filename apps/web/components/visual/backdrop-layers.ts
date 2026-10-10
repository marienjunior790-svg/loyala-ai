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
  for (const [layer] of ordered) {
    if (!layer.isConnected || layer.width === 0 || layer.height === 0) continue;
    const box = layer.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const kx = layer.width / box.width;
    const ky = layer.height / box.height;
    try {
      ctx.drawImage(
        layer,
        (rect.left - box.left) * kx,
        (rect.top - box.top) * ky,
        rect.width * kx,
        rect.height * ky,
        0,
        0,
        width,
        height
      );
    } catch {
      // A layer can be mid-resize or have lost its WebGL context; skip this frame.
    }
  }

  getInstance()?.markChanged(canvas);
}
