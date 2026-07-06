import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartPoint } from '@/lib/dashboard/metrics';

interface MiniBarChartProps {
  data: ChartPoint[];
  color?: string;
}

export function MiniBarChart({ data, color = 'hsl(var(--primary))' }: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-40 items-end justify-between gap-2 pt-4">
      {data.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${(point.value / max) * 100}%`,
                minHeight: '8%',
                background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
              }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

interface AnalyticsPanelProps {
  title: string;
  description: string;
  data: ChartPoint[];
  footer?: string;
}

export function AnalyticsPanel({ title, description, data, footer }: AnalyticsPanelProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <MiniBarChart data={data} />
            {footer && <p className="mt-4 text-xs text-muted-foreground">{footer}</p>}
          </>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center">
            <p className="text-sm text-muted-foreground">Données insuffisantes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les graphiques apparaîtront après vos premières visites clients.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
