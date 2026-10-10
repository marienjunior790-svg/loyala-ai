'use client';

import dynamic from 'next/dynamic';
import { useVisualQuality } from './use-visual-quality';

const AuthScene = dynamic(() => import('./auth-scene'), { ssr: false });

export function AuthBackdrop3D() {
  if (useVisualQuality() !== 'full') return null;
  return (
    <AuthScene className="animate-backdrop-in pointer-events-none fixed inset-0 -z-[5]" />
  );
}
