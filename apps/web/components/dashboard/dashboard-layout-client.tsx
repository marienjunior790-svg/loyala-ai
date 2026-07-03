'use client';

import { usePathname } from 'next/navigation';
import { DashboardShell } from './dashboard-shell';
import { mainNav, isNavActive } from '@/lib/dashboard/navigation';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  role?: string;
}

export function DashboardLayoutClient({ children, role }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const current = mainNav.find((item) => isNavActive(pathname, item.href)) ?? mainNav[0];

  return (
    <DashboardShell title={current.label} subtitle={current.description} role={role}>
      {children}
    </DashboardShell>
  );
}
