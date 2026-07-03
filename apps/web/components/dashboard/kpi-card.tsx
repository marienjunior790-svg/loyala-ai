import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KpiMetric } from '@/lib/dashboard/metrics';

interface KpiCardProps {
  metric: KpiMetric;
  className?: string;
}

export function KpiCard({ metric, className }: KpiCardProps) {
  const TrendIcon =
    metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    metric.trend === 'up'
      ? 'text-emerald-400'
      : metric.trend === 'down'
        ? 'text-amber-400'
        : 'text-muted-foreground';

  return (
    <Card
      className={cn(
        'group overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-glow',
        className
      )}
    >
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{metric.label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{metric.value}</p>
        <div className={cn('mt-3 flex items-center gap-1.5 text-xs', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="font-medium">
            {metric.change > 0 ? '+' : ''}
            {metric.change}%
          </span>
          <span className="text-muted-foreground">{metric.changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiGridProps {
  metrics: KpiMetric[];
}

export function KpiGrid({ metrics }: KpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric, index) => (
        <div
          key={metric.id}
          className={cn('animate-slide-up opacity-0', `stagger-${Math.min(index + 1, 6)}`)}
        >
          <KpiCard metric={metric} />
        </div>
      ))}
    </div>
  );
}
