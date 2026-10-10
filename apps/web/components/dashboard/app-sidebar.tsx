'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';
import { BrandLockup } from '@/components/brand/liquid-logo';
import { useLiquidGlass } from '@/components/glass/use-liquid-glass';

type IndicatorBox = { top: number; height: number } | null;

export function AppSidebar({
  onNavigate,
  surface = 'liquid',
}: {
  onNavigate?: () => void;
  surface?: 'liquid' | 'strong';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorBox>(null);
  const { rootRef, glassRef, mirror, active } = useLiquidGlass<HTMLDivElement, HTMLElement>();

  const activeHref = mainNav.find((item) => isNavActive(pathname, item.href))?.href ?? null;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const el = activeHref
        ? list.querySelector<HTMLElement>(`[data-nav-href="${CSS.escape(activeHref)}"]`)
        : null;
      setIndicator(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <div ref={rootRef} className="relative h-full w-full">
      {surface === 'liquid' && mirror}
      <aside
        ref={glassRef}
        className={cn(
          'flex h-full w-full flex-col rounded-3xl',
          surface === 'strong' ? 'glass-strong' : 'glass-liquid',
          active && 'glass-webgl'
        )}
      >
        <div className="flex h-24 shrink-0 items-center px-5">
          <Link href="/dashboard" aria-label="Tableau de bord" className="rounded-xl">
            <BrandLockup size={52} tagline="Restaurant CRM" priority />
          </Link>
        </div>

        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <nav
          aria-label="Navigation principale"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-6"
        >
          <div ref={listRef} className="relative space-y-1">
            {indicator && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28),0_0_24px_-6px_hsl(var(--primary)/0.55)] transition-[transform,height] duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height }}
              />
            )}
            {mainNav.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  data-nav-href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    // Force client navigation even if something intercepts the default Link behavior.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    onNavigate?.();
                    if (pathname !== item.href) {
                      router.push(item.href);
                    }
                  }}
                  className={cn(
                    'group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200',
                    active
                      ? 'text-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-white/[0.05] hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active
                        ? 'text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span className="truncate font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
    </div>
  );
}
