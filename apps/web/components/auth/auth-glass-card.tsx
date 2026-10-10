'use client';

import { useLiquidGlass } from '@/components/glass/use-liquid-glass';
import { cn } from '@/lib/utils';

export function AuthGlassCard({ children }: { children: React.ReactNode }) {
  const { rootRef, glassRef, mirror, active } = useLiquidGlass({ blurAmount: 0.4, brightness: -0.28 });

  return (
    <div ref={rootRef} className="relative w-full max-w-md animate-slide-up">
      {mirror}
      <div
        ref={glassRef}
        className={cn(
          'glass-liquid w-full rounded-3xl px-6 py-8 sm:px-10 sm:py-10',
          active && 'glass-webgl'
        )}
      >
        {children}
      </div>
    </div>
  );
}
