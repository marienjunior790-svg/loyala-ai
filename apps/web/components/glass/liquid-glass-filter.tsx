'use client';

import { useEffect } from 'react';

type NavigatorUAData = Navigator & { userAgentData?: { brands?: { brand: string }[] } };

/**
 * Shared SVG filter referenced by `.glass-liquid` via `backdrop-filter: url(#liquid-glass)`.
 * Only Chromium renders SVG filters inside backdrop-filter; elsewhere `.glass-liquid`
 * keeps the plain frosted-glass fallback, so the class is opt-in on <html>.
 */
export function LiquidGlassFilter() {
  useEffect(() => {
    const brands = (navigator as NavigatorUAData).userAgentData?.brands ?? [];
    if (brands.some((b) => b.brand === 'Chromium')) {
      document.documentElement.classList.add('liquid-glass');
    }
  }, []);

  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }}>
      <filter
        id="liquid-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.006 0.01"
          numOctaves={2}
          seed={11}
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation={2.5} result="softNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale={60}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
