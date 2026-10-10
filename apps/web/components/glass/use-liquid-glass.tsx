'use client';

import { useEffect, useRef, useState } from 'react';
import type { GlassConfig, LiquidGlass } from '@ybouane/liquidglass';
import { registerBackdropMirror } from '@/components/visual/backdrop-layers';
import { useVisualQuality } from '@/components/visual/use-visual-quality';

export type LiquidGlassConfig = Partial<GlassConfig>;

/** Tuned for white text over the dark green backdrop. */
const BASE_CONFIG: LiquidGlassConfig = {
  refraction: 0.8,
  blurAmount: 0.3,
  chromAberration: 0.12,
  edgeHighlight: 0.2,
  // The library's bottom specular light paints a grey band along the lower rim.
  specular: 0,
  fresnel: 1,
  zRadius: 28,
  brightness: -0.24,
  saturation: 0.1,
  shadowOpacity: 0.45,
  shadowSpread: 18,
  shadowOffsetY: 8,
};

/**
 * WebGL liquid glass (@ybouane/liquidglass) on desktop, CSS glass everywhere else.
 *
 * The library refracts only its root's direct children, so `glassRef` must be a direct child of
 * `rootRef`, and `mirror` must be rendered as another direct child: it carries a live copy of the
 * animated backdrop. Keep the `glass-*` CSS class on the glass element as the fallback.
 */
export function useLiquidGlass<
  Root extends HTMLElement = HTMLDivElement,
  Glass extends HTMLElement = HTMLDivElement,
>(config?: LiquidGlassConfig) {
  const rootRef = useRef<Root>(null);
  const glassRef = useRef<Glass>(null);
  const mirrorRef = useRef<HTMLCanvasElement>(null);
  const enabled = useVisualQuality() === 'full';
  const [active, setActive] = useState(false);
  const configKey = JSON.stringify(config ?? {});

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    const mirror = mirrorRef.current;
    if (!enabled || !root || !glass || !mirror) return;

    let cancelled = false;
    let instance: LiquidGlass | null = null;
    let unregister: (() => void) | null = null;

    void (async () => {
      const { LiquidGlass } = await import('@ybouane/liquidglass');
      if (cancelled) return;

      const rect = glass.getBoundingClientRect();
      // Hidden at this breakpoint (e.g. the mobile bar on a wide screen): keep the CSS glass.
      if (rect.width === 0 || rect.height === 0) return;
      const radius = parseFloat(getComputedStyle(glass).borderTopLeftRadius) || 0;
      glass.dataset.config = JSON.stringify({
        ...BASE_CONFIG,
        cornerRadius: Math.min(radius, rect.height / 2, rect.width / 2),
        ...(JSON.parse(configKey) as LiquidGlassConfig),
      });

      unregister = registerBackdropMirror({ canvas: mirror, getInstance: () => instance });
      try {
        const created = await LiquidGlass.init({ root, glassElements: [glass] });
        if (cancelled) {
          created.destroy();
          return;
        }
        // The library disables text selection for its drag feature, which we never enable.
        root.style.removeProperty('user-select');
        root.style.removeProperty('-webkit-user-select');
        instance = created;
        setActive(true);
      } catch {
        unregister();
        unregister = null;
      }
    })();

    return () => {
      cancelled = true;
      unregister?.();
      instance?.destroy();
      delete glass.dataset.config;
      setActive(false);
    };
  }, [enabled, configKey]);

  const mirror = enabled ? (
    <canvas
      ref={mirrorRef}
      aria-hidden
      className="pointer-events-none invisible absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)]"
    />
  ) : null;

  return { rootRef, glassRef, mirror, active };
}
