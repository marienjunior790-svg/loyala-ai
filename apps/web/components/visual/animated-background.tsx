'use client';

import dynamic from 'next/dynamic';
import { useVisualQuality } from './use-visual-quality';

const ShaderBackdrop = dynamic(() => import('./shader-backdrop'), { ssr: false });
const GlitterField = dynamic(() => import('./glitter-field'), { ssr: false });

export function AnimatedBackground() {
  const quality = useVisualQuality();
  const full = quality === 'full';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="app-backdrop absolute inset-0" />
      {full && <ShaderBackdrop />}
      <div className="app-vignette absolute inset-0" />
      {full ? <GlitterField /> : <div className="app-glitter absolute inset-0" />}
    </div>
  );
}
