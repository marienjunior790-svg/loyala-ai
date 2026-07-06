import { MessageCircle, Star, Gift, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityItem } from '@/lib/dashboard/metrics';
import { cn } from '@/lib/utils';

const typeConfig = {
  client: { icon: Users, color: 'text-sky-400 bg-sky-400/10' },
  campaign: { icon: MessageCircle, color: 'text-emerald-400 bg-emerald-400/10' },
  review: { icon: Star, color: 'text-amber-400 bg-amber-400/10' },
  loyalty: { icon: Gift, color: 'text-violet-400 bg-violet-400/10' },
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Activité récente</CardTitle>
        <CardDescription>Dernières actions sur votre restaurant</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">Pas encore d&apos;activité enregistrée.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoutez un client et envoyez votre première relance WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 transition hover:border-border"
                >
                  <div className={cn('rounded-lg p-2', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
