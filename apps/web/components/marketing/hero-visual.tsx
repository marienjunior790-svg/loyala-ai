'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCheck, Gift } from 'lucide-react';
import { LiquidLogo } from '@/components/brand/liquid-logo';
import { useVisualQuality } from '@/components/visual/use-visual-quality';
import { cn } from '@/lib/utils';

const HeroScene = dynamic(() => import('@/components/visual/hero-scene'), { ssr: false });

function PhoneMockup() {
  return (
    <div className="glass-liquid mx-auto flex h-full max-h-[520px] w-full max-w-[270px] flex-col rounded-[2.5rem] p-3 shadow-glow-lg">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] bg-black/45">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
          <LiquidLogo size={30} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">Loyala AI</p>
            <p className="mt-1 text-[10px] text-primary">en ligne</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2.5 p-3 text-[12px] leading-snug">
          <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white/[0.08] px-3 py-2">
            Bonjour Awa 👋 Ça fait 3 semaines ! Votre plat préféré vous attend ce week-end 🍲
          </p>
          <p className="flex max-w-[80%] items-end gap-1 self-end rounded-2xl rounded-br-md bg-primary/85 px-3 py-2 text-primary-foreground">
            Super, je réserve pour samedi !
            <CheckCheck className="h-3 w-3 shrink-0 opacity-80" />
          </p>
          <p className="flex items-center gap-2 self-start rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-gold">
            <Gift className="h-3.5 w-3.5" />
            Visite enregistrée · +50 points
          </p>
        </div>
      </div>
    </div>
  );
}

export function HeroVisual({ className }: { className?: string }) {
  const quality = useVisualQuality();
  const [sceneReady, setSceneReady] = useState(false);
  const full = quality === 'full';

  return (
    <div className={cn('relative aspect-[4/5] w-full', className)}>
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-700',
          full && sceneReady && 'pointer-events-none opacity-0'
        )}
      >
        <PhoneMockup />
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
