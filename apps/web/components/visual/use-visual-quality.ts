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

let webglSupport: boolean | null = null;

function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
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
  return () => queries.forEach((q) => q.removeEventListener('change', onChange));
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
