'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useVisualQuality } from '@/components/visual/use-visual-quality';

const LiquidMetalMark = dynamic(() => import('./liquid-metal-mark'), { ssr: false });

interface LiquidLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Brand mark rendered as animated liquid metal on capable devices; the colour PNG stays
 * underneath as the SSR/lite rendering and fades out once the shader has had time to start.
 */
export function LiquidLogo({ size = 40, className, priority = false }: LiquidLogoProps) {
  const quality = useVisualQuality();
  const liquid = quality === 'full';

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image
        src="/brand/loyala-mark.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className={cn(
          'absolute inset-0 h-full w-full object-contain transition-opacity duration-700',
          liquid && 'opacity-0 [transition-delay:900ms]'
        )}
      />
      {liquid && (
        <LiquidMetalMark className="animate-backdrop-in absolute inset-0 h-full w-full" />
      )}
    </span>
  );
}

interface BrandLockupProps {
  size?: number;
  tagline?: string;
  className?: string;
  priority?: boolean;
}

export function BrandLockup({ size = 36, tagline, className, priority }: BrandLockupProps) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LiquidLogo size={size} priority={priority} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[0.12em]">
          <span className="text-gradient-silver">LOYALA</span>{' '}
          <span className="text-gold">AI</span>
        </span>
        {tagline && (
          <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
