import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listNotifications } from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from './_actions/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  let error: string | null = null;

  try {
    notifications = await listNotifications(supabase, ctx.userId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Alertes et activité récente</p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" size="sm">
            Tout marquer lu
          </Button>
        </form>
      </div>

      {error && <ModuleError message={error} />}

      {notifications.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={!n.read_at ? 'border-primary/30' : ''}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read_at && <Badge variant="default">Nouveau</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  {n.link && (
                    <Link href={n.link} className="mt-2 inline-block text-xs text-primary">
                      Voir détails →
                    </Link>
                  )}
                </div>
                {!n.read_at && (
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Lu
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
