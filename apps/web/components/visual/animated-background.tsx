'use client';

import dynamic from 'next/dynamic';
import { useVisualQuality } from './use-visual-quality';

const ShaderBackdrop = dynamic(() => import('./shader-backdrop'), { ssr: false });

export function AnimatedBackground() {
  const quality = useVisualQuality();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="app-backdrop absolute inset-0" />
      {quality === 'full' && <ShaderBackdrop />}
      <div className="app-vignette absolute inset-0" />
    </div>
  );
}
