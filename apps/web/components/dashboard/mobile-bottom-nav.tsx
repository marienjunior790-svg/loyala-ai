'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mobileNav, isNavActive } from '@/lib/dashboard/navigation';

export function MobileBottomNav() {
  const pathname = usePathname();
  const items = mobileNav.slice(0, 5);

  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
    >
      <div className="glass-strong mx-auto flex max-w-lg items-stretch justify-around rounded-full p-1.5">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]')} />
              <span className="max-w-[4.5rem] truncate">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
