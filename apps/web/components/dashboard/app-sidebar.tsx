'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <span className="text-sm font-bold text-primary">L</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Loyala AI</p>
          <p className="text-[11px] text-muted-foreground">Restaurant CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {mainNav.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
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

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg border border-border/60 bg-card/50 p-3">
          <p className="text-xs font-medium">Plan Growth</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Débloquez campagnes avancées et analytics prédictifs.
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            Upgrader
          </button>
        </div>
      </div>
    </aside>
  );
}
