import type { SupabaseClient } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createNotification(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    title: string;
    body: string;
    type?: string;
    link?: string;
  }
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    title: input.title,
    body: input.body,
    type: input.type ?? 'info',
    link: input.link ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}
