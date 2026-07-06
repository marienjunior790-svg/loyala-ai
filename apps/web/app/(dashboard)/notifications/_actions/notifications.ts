'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { markNotificationRead, markAllNotificationsRead } from '@loyala/domain-crm';

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  try {
    const ctx = await requireAuth();
    const supabase = await createClient();
    await markNotificationRead(supabase, ctx.userId, notificationId);
    revalidatePath('/notifications');
  } catch (e) {
    console.error('[notifications] mark read failed', e);
  }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  try {
    const ctx = await requireAuth();
    const supabase = await createClient();
    await markAllNotificationsRead(supabase, ctx.userId);
    revalidatePath('/notifications');
  } catch (e) {
    console.error('[notifications] mark all read failed', e);
  }
}
