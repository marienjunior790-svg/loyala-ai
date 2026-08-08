'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <span className="text-sm font-bold text-primary">L</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Loyala AI</p>
          <p className="text-[11px] text-muted-foreground">Restaurant CRM</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 pb-6">
        {mainNav.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
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
                'group relative z-10 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                active
                  ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span className="truncate font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
