'use client';

import Link from 'next/link';
import { Menu, Bell, Search, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLiquidGlass } from '@/components/glass/use-liquid-glass';
import { logoutAction } from '@/app/(auth)/_actions/auth';
import { cn } from '@/lib/utils';
import { resolveOrgRole } from '@/lib/auth/role-map';
import { roleLabel } from '@/lib/labels';

interface TopNavbarProps {
  title: string;
  subtitle?: string;
  role?: string;
  displayName?: string;
  unreadNotifications?: number;
  onMenuClick?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function TopNavbar({
  title,
  subtitle,
  role,
  displayName,
  unreadNotifications = 0,
  onMenuClick,
}: TopNavbarProps) {
  const { rootRef, glassRef, mirror, active } = useLiquidGlass<HTMLElement>();
  const resolvedRole = resolveOrgRole(role);
  const roleName = resolvedRole ? roleLabel(resolvedRole) : 'Membre';

  return (
    <header ref={rootRef} className="sticky top-0 z-30 px-3 pt-3 lg:pl-0">
      {mirror}
      <div
        ref={glassRef}
        className={cn(
          'glass-liquid flex h-16 items-center justify-between gap-4 rounded-2xl px-3 md:px-5',
          active && 'glass-webgl'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2.5">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 md:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Rechercher...</span>
            <kbd className="ml-6 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            asChild
            aria-label="Notifications"
          >
            <Link href="/notifications">
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground shadow-glow">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          </Button>

          <div className="hidden items-center gap-2 sm:flex">
            <Avatar className="ring-1 ring-primary/30">
              <AvatarFallback className="bg-primary/15 text-primary">
                {initials(displayName ?? roleName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden max-w-[160px] md:block">
              <p className="truncate text-sm font-medium leading-none">{displayName ?? roleName}</p>
              {displayName && (
                <p className="mt-1 text-[11px] leading-none text-muted-foreground">{roleName}</p>
              )}
            </div>
          </div>

          <form action={logoutAction}>
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              className="rounded-full"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
