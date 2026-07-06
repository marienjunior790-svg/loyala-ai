import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/session';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();

  return (
    <Suspense
      fallback={
        <DashboardShell title="Loyala AI" subtitle="Chargement...">
          {children}
        </DashboardShell>
      }
    >
      <DashboardLayoutClient role={ctx?.role}>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
