'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCompactMoney, formatMoney } from '@/lib/clients/money';

export interface SpendPoint {
  key: string;
  label: string;
  /** Libellé complet affiché au survol (ex. « mardi 13 oct. »). */
  title: string;
  spent: number;
  visits: number;
  future?: boolean;
}

interface SpendChartProps {
  points: SpendPoint[];
  currency: string;
  totalLabel?: string;
  className?: string;
}

export function SpendChart({ points, currency, totalLabel = 'Total de la période', className }: SpendChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((point) => point.spent), 1);
  const labelStep = Math.max(1, Math.ceil(points.length / 12));
  const total = points.reduce((sum, point) => sum + point.spent, 0);
  const visits = points.reduce((sum, point) => sum + point.visits, 0);
  const shown = active !== null ? points[active] : null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex min-h-10 flex-wrap items-baseline justify-between gap-2" aria-live="polite">
        {shown ? (
          <>
            <p className="text-sm text-muted-foreground">{shown.title}</p>
            <p className="text-sm">
              <span className="text-lg font-semibold">{formatMoney(shown.spent, currency)}</span>
              <span className="ml-2 text-muted-foreground">
                {shown.visits} commande{shown.visits > 1 ? 's' : ''}
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{totalLabel}</p>
            <p className="text-sm">
              <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
              <span className="ml-2 text-muted-foreground">
                {visits} commande{visits > 1 ? 's' : ''}
              </span>
            </p>
          </>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between">
          {[1, 0.5, 0].map((ratio) => (
            <div key={ratio} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">
                {formatCompactMoney(max * ratio, currency).replace(/ (FCFA|[A-Z]{3})$/, '')}
              </span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          ))}
        </div>

        <div className="ml-16 flex h-44 items-end gap-[3px]" onMouseLeave={() => setActive(null)}>
          {points.map((point, index) => (
            <button
              key={point.key}
              type="button"
              aria-label={`${point.title} : ${formatMoney(point.spent, currency)}, ${point.visits} commande${point.visits > 1 ? 's' : ''}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="group flex h-full flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'block w-full rounded-t-[4px] transition-all duration-300',
                  point.future ? 'bg-white/[0.04]' : 'bg-gradient-to-t from-primary/35 to-primary',
                  active === index && !point.future && 'brightness-125',
                  active !== null && active !== index && 'opacity-50'
                )}
                style={{
                  height: point.spent > 0 ? `${Math.max((point.spent / max) * 100, 3)}%` : '2px',
                }}
              />
            </button>
          ))}
        </div>

        <div className="ml-16 mt-2 flex gap-[3px]" aria-hidden>
          {points.map((point, index) => (
            <span
              key={point.key}
              className={cn(
                'flex-1 truncate text-center text-[10px]',
                active === index ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {index % labelStep === 0 || active === index ? point.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
