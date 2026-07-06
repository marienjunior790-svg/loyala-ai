'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AppSidebar } from './app-sidebar';
import { TopNavbar } from './top-navbar';
import { MobileBottomNav } from './mobile-bottom-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  role?: string;
  unreadNotifications?: number;
}

export function DashboardShell({
  children,
  title,
  subtitle,
  role,
  unreadNotifications = 0,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-64">
          <AppSidebar />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-in slide-in-from-left duration-200">
            <div className="relative h-full">
              <AppSidebar onNavigate={() => setMobileOpen(false)} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-3"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <TopNavbar
          title={title}
          subtitle={subtitle}
          role={role}
          unreadNotifications={unreadNotifications}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className={cn('flex-1 overflow-auto pb-20 lg:pb-6')}>
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
