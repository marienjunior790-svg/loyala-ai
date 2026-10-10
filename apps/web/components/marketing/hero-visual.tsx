'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useVisualQuality } from '@/components/visual/use-visual-quality';
import { cn } from '@/lib/utils';
import { PhoneChatScreen } from './phone-chat-screen';
import { CampaignCard, LoyaltyCard, ReturnCard } from './hero-float-cards';

const HeroScene = dynamic(() => import('@/components/visual/hero-scene'), { ssr: false });

/** Same composition as the 3D scene, flat: shown on mobile, reduced motion and while WebGL loads. */
function StaticComposition() {
  return (
    <div className="relative origin-center scale-[0.66] sm:scale-90 xl:scale-100">
      <div className="rounded-[2.6rem] bg-gradient-to-b from-[#2C4636] via-[#14231a] to-[#0b140f] p-[3px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.95),0_0_60px_-20px_hsl(var(--primary)/0.5)]">
        <div className="rounded-[2.45rem] bg-black p-[7px]">
          <PhoneChatScreen />
        </div>
      </div>
      <ReturnCard className="absolute -right-24 top-16 hidden sm:flex" />
      <CampaignCard className="absolute -left-28 top-[45%] hidden sm:flex" />
      <LoyaltyCard className="absolute -right-20 bottom-16 hidden sm:flex" />
    </div>
  );
}

export function HeroVisual({ className }: { className?: string }) {
  const quality = useVisualQuality();
  const [sceneReady, setSceneReady] = useState(false);
  const full = quality === 'full';

  return (
    <div className={cn('relative aspect-[9/10] w-full', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.28),transparent)] blur-2xl"
      />
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-700',
          full && sceneReady && 'pointer-events-none opacity-0'
        )}
      >
        <StaticComposition />
      </div>
      {full && (
        <HeroScene
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            sceneReady ? 'opacity-100' : 'opacity-0'
          )}
          onReady={() => setSceneReady(true)}
        />
      )}
    </div>
  );
}
