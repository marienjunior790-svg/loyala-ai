import type { Metadata } from 'next';
import { getAuthContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { countUnreadNotifications, getMyProfile } from '@loyala/domain-crm';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  let unreadNotifications = 0;
  let displayName: string | undefined;

  if (ctx?.userId) {
    const supabase = await createClient();
    const [unread, profile] = await Promise.all([
      countUnreadNotifications(supabase, ctx.userId).catch(() => 0),
      getMyProfile(supabase, ctx.userId).catch(() => null),
    ]);
    unreadNotifications = unread;
    displayName = profile?.full_name ?? undefined;
  }

  return (
    <DashboardLayoutClient
      role={ctx?.role}
      displayName={displayName}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </DashboardLayoutClient>
  );
}
