import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartPoint } from '@/lib/dashboard/metrics';

interface MiniBarChartProps {
  data: ChartPoint[];
  color?: string;
  hrefForPoint?: (point: ChartPoint) => string | null;
}

export function MiniBarChart({
  data,
  color = 'hsl(var(--primary))',
  hrefForPoint,
}: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-40 items-end justify-between gap-2 pt-4">
      {data.map((point) => {
        const barInner = (
          <>
            <div className="relative flex w-full flex-1 items-end justify-center">
              {point.value > 0 && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-foreground">
                  {point.value}
                </span>
              )}
              <div
                className="w-full rounded-t-md transition-all duration-500 group-hover/bar:brightness-110"
                style={{
                  height: point.value > 0 ? `${(point.value / max) * 100}%` : '0%',
                  minHeight: point.value > 0 ? '12%' : '0%',
                  background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground group-hover/bar:text-foreground">
              {point.label}
            </span>
          </>
        );

        const pointHref = hrefForPoint?.(point) ?? null;
        if (pointHref) {
          return (
            <Link
              key={point.label}
              href={pointHref}
              className="group/bar flex flex-1 flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {barInner}
            </Link>
          );
        }

        return (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
            {barInner}
          </div>
        );
      })}
    </div>
  );
}

const SEGMENT_HREF: Record<string, string> = {
  Nouveaux: '/clients?segment=new',
  Réguliers: '/clients?segment=regular',
  VIP: '/clients?segment=vip',
  Inactifs: '/clients?segment=inactive',
  'À risque': '/clients?segment=at_risk',
};

interface AnalyticsPanelProps {
  title: string;
  description: string;
  data: ChartPoint[];
  footer?: string;
  href?: string;
  actionLabel?: string;
  segmentLinks?: boolean;
}

export function AnalyticsPanel({
  title,
  description,
  data,
  footer,
  href,
  actionLabel,
  segmentLinks = false,
}: AnalyticsPanelProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);
  const cta = actionLabel ?? (href ? 'Voir le détail' : null);

  return (
    <Card className="animate-fade-in transition-all duration-200 hover:border-primary/40 hover:shadow-glow">
      <CardHeader className="pb-2">
        {href ? (
          <Link
            href={href}
            className="group flex items-start justify-between gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <CardTitle className="group-hover:text-primary">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/20">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <MiniBarChart
              data={data}
              hrefForPoint={
                segmentLinks ? (point) => SEGMENT_HREF[point.label] ?? null : undefined
              }
            />
            {footer && <p className="mt-4 text-xs text-muted-foreground">{footer}</p>}
          </>
        ) : href ? (
          <Link
            href={href}
            className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center transition hover:border-primary/40 hover:bg-primary/5"
          >
            <p className="text-sm text-muted-foreground">Données insuffisantes</p>
            <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
              Les graphiques apparaîtront après vos premières visites clients.
            </p>
            {cta && (
              <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                {cta}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </p>
            )}
          </Link>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center">
            <p className="text-sm text-muted-foreground">Données insuffisantes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les graphiques apparaîtront après vos premières visites clients.
            </p>
          </div>
        )}
        {cta && href && hasData && (
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {cta}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
