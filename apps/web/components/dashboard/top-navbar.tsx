'use client';

import { Menu, Bell, Search, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logoutAction } from '@/app/(auth)/_actions/auth';

interface TopNavbarProps {
  title: string;
  subtitle?: string;
  role?: string;
  onMenuClick?: () => void;
}

export function TopNavbar({ title, subtitle, role, onMenuClick }: TopNavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
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

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Rechercher...</span>
          <kbd className="ml-6 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        <div className="hidden items-center gap-2 sm:flex">
          <Avatar>
            <AvatarFallback className="bg-primary/15 text-primary">LA</AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none">Admin</p>
            {role && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {role}
              </Badge>
            )}
          </div>
        </div>

        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Déconnexion">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
