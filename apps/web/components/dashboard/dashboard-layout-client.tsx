'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { DashboardShell } from './dashboard-shell';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

function resolvePageMeta(pathname: string, nouveau: boolean) {
  if (pathname === '/clients' && nouveau) {
    return { title: 'Nouveau client', subtitle: 'Ajoutez un contact à votre CRM' };
  }

  if (pathname.match(/^\/clients\/[^/]+\/edit$/)) {
    return { title: 'Modifier le client', subtitle: 'Mettez à jour les informations' };
  }

  if (pathname.match(/^\/clients\/[^/]+$/)) {
    return { title: 'Fiche client', subtitle: 'Détails et relance WhatsApp' };
  }

  const current = mainNav.find((item) => isNavActive(pathname, item.href)) ?? mainNav[0];
  return { title: current.label, subtitle: current.description };
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  role?: string;
}

export function DashboardLayoutClient({ children, role }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nouveau = searchParams.get('nouveau') === '1';
  const { title, subtitle } = resolvePageMeta(pathname, nouveau);

  return (
    <DashboardShell title={title} subtitle={subtitle} role={role}>
      {children}
    </DashboardShell>
  );
}
