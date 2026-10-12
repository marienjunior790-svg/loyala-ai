'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AppSidebar } from './app-sidebar';
import { TopNavbar } from './top-navbar';
import { MobileBottomNav } from './mobile-bottom-nav';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  role?: string;
  displayName?: string;
  unreadNotifications?: number;
}

export function DashboardShell({
  children,
  title,
  subtitle,
  role,
  displayName,
  unreadNotifications = 0,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen">
      <SkipLink />
      <div className="hidden w-[17.5rem] shrink-0 lg:block">
        <div className="fixed inset-y-3 left-3 z-30 w-64">
          <AppSidebar />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute inset-y-3 left-3 w-72 max-w-[calc(100vw-1.5rem)] animate-in slide-in-from-left duration-300">
            <div className="relative h-full">
              <AppSidebar onNavigate={() => setMobileOpen(false)} surface="strong" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-7 rounded-full"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          title={title}
          subtitle={subtitle}
          role={role}
          displayName={displayName}
          unreadNotifications={unreadNotifications}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main id="main-content" className={cn('flex-1 overflow-auto pb-28 lg:pb-6')}>
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
