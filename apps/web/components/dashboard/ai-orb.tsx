'use client';

import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { useVisualQuality } from '@/components/visual/use-visual-quality';
import { cn } from '@/lib/utils';

const AiOrbScene = dynamic(() => import('@/components/visual/ai-orb-scene'), { ssr: false });

/** 3D orb on desktop; a glowing icon tile elsewhere. */
export function AiOrb({ className }: { className?: string }) {
  const full = useVisualQuality() === 'full';

  return (
    <div className={cn('relative h-28 w-28 shrink-0', className)} aria-hidden>
      {full ? (
        <AiOrbScene className="animate-backdrop-in absolute inset-0" />
      ) : (
        <div className="absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 shadow-glow ring-1 ring-primary/30">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      )}
    </div>
  );
}
