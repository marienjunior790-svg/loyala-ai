import { getAuthContext } from '@/lib/auth/session';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();

  return (
    <DashboardLayoutClient role={ctx?.role}>
      {children}
    </DashboardLayoutClient>
  );
}
