'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

export function MobileBottomNav() {
  const pathname = usePathname();
  const items = mainNav.slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-[4.5rem] truncate">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
