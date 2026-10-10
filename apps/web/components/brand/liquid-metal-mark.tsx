'use client';

import { LiquidMetal } from '@paper-design/shaders-react';

/** Loaded through next/dynamic only — the shader + image preprocessing stay out of the main bundle. */
export default function LiquidMetalMark({ className }: { className?: string }) {
  return (
    <LiquidMetal
      className={className}
      image="/brand/loyala-mark-mask.png"
      colorBack="#00000000"
      colorTint="#3DFF95"
      fit="contain"
      scale={1}
      speed={0.6}
      repetition={2.5}
      softness={0.15}
      shiftRed={0.25}
      shiftBlue={0.25}
      distortion={0.08}
      contour={0.45}
      angle={70}
      maxPixelCount={400_000}
    />
  );
}
