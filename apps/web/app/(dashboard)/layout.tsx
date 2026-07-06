import type { Metadata } from 'next';
import { getAuthContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { countUnreadNotifications } from '@loyala/domain-crm';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  let unreadNotifications = 0;

  if (ctx?.userId) {
    try {
      const supabase = await createClient();
      unreadNotifications = await countUnreadNotifications(supabase, ctx.userId);
    } catch {
      unreadNotifications = 0;
    }
  }

  return (
    <DashboardLayoutClient
      role={ctx?.role}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </DashboardLayoutClient>
  );
}
