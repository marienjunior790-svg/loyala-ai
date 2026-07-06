'use client';

import { usePathname } from 'next/navigation';
import { DashboardShell } from './dashboard-shell';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/clients/ajouter': {
    title: 'Nouveau client',
    subtitle: 'Ajoutez un contact à votre CRM',
  },
  '/clients/new': {
    title: 'Nouveau client',
    subtitle: 'Ajoutez un contact à votre CRM',
  },
};

function resolvePageMeta(pathname: string) {
  const exact = PAGE_TITLES[pathname];
  if (exact) return exact;

  if (pathname.match(/^\/clients\/[^/]+\/edit$/)) {
    return { title: 'Modifier le client', subtitle: 'Mettez à jour les informations' };
  }

  if (pathname.match(/^\/clients\/[^/]+$/) && pathname !== '/clients/ajouter') {
    return { title: 'Fiche client', subtitle: 'Détails et relance WhatsApp' };
  }

  const current = mainNav.find((item) => isNavActive(pathname, item.href)) ?? mainNav[0];
  return { title: current.label, subtitle: current.description };
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  role?: string;
  unreadNotifications?: number;
}

export function DashboardLayoutClient({
  children,
  role,
  unreadNotifications = 0,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const { title, subtitle } = resolvePageMeta(pathname);

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      role={role}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </DashboardShell>
  );
}
