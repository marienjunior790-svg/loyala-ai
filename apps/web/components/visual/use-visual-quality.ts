'use client';

import { useSyncExternalStore } from 'react';

/**
 * `full`: animated WebGL backdrop, 3D scenes, liquid-metal logo.
 * `lite`: static artwork — touch devices, low-end hardware, Save-Data, reduced motion, no WebGL.
 * `null` during SSR and the first client render.
 */
export type VisualQuality = 'full' | 'lite';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** Desktop-class input, not viewport width: a narrow window on a PC still gets the full scene. */
const DESKTOP = '(hover: hover) and (pointer: fine)';

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/** Context creation can fail transiently while a previous page's contexts are being freed. */
const WEBGL_RETRY_MS = 2000;

let webglSupported = false;
let webglFailedAt = -Infinity;

function hasWebGL(): boolean {
  if (webglSupported) return true;
  if (performance.now() - webglFailedAt < WEBGL_RETRY_MS) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      webglSupported = true;
      return true;
    }
  } catch {
    // Treated like a missing context below.
  }
  webglFailedAt = performance.now();
  return false;
}

function getSnapshot(): VisualQuality {
  if (window.matchMedia(REDUCED_MOTION).matches) return 'lite';
  if (!window.matchMedia(DESKTOP).matches) return 'lite';

  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return 'lite';
  if ((nav.hardwareConcurrency ?? 8) < 4) return 'lite';
  if ((nav.deviceMemory ?? 8) < 4) return 'lite';

  return hasWebGL() ? 'full' : 'lite';
}

function subscribe(onChange: () => void): () => void {
  const queries = [REDUCED_MOTION, DESKTOP].map((q) => window.matchMedia(q));
  queries.forEach((q) => q.addEventListener('change', onChange));
  const retry = webglSupported ? 0 : window.setTimeout(onChange, WEBGL_RETRY_MS + 100);
  return () => {
    queries.forEach((q) => q.removeEventListener('change', onChange));
    window.clearTimeout(retry);
  };
}

function getServerSnapshot(): VisualQuality | null {
  return null;
}

export function useVisualQuality(): VisualQuality | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const q = window.matchMedia(REDUCED_MOTION);
      q.addEventListener('change', onChange);
      return () => q.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
}
