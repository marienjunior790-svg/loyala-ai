'use client';

import type { CatalogQualityReport } from '@loyala/domain-crm';

const SEVERITY_CLASS = {
  high: 'border-destructive/40 bg-destructive/10 text-destructive',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  low: 'border-border bg-secondary/40 text-muted-foreground',
} as const;

export function CatalogQualityPanel({
  report,
  onAction,
}: {
  report: CatalogQualityReport;
  onAction?: (kind: string) => void;
}) {
  const { score, breakdown, kpis, recommendations } = report;
  const ring =
    score >= 80 ? 'text-emerald-400' : score >= 55 ? 'text-amber-300' : 'text-destructive';

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Score qualité catalogue
          </p>
          <p className={`mt-1 text-4xl font-semibold tabular-nums ${ring}`}>{score}<span className="text-lg text-muted-foreground">/100</span></p>
          <p className="mt-1 text-xs text-muted-foreground">
            Complétion {kpis.completionPct}% · {kpis.incomplete} incomplet(s)
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Kpi label="Produits" value={kpis.products} />
          <Kpi label="Catégories" value={kpis.categories} />
          <Kpi label="Variantes" value={kpis.variants} />
          <Kpi label="Sans photo" value={kpis.withoutImage} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {(
          [
            ['Images', breakdown.images],
            ['Descriptions', breakdown.descriptions],
            ['Prix', breakdown.prices],
            ['Variantes', breakdown.variants],
            ['Catégories', breakdown.categories],
            ['Dispo', breakdown.availability],
            ['Mise en avant', breakdown.highlight],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/60 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
            </div>
            <p className="mt-0.5 text-xs tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recommandations</p>
          <ul className="space-y-1.5">
            {recommendations.slice(0, 6).map((r, i) => (
              <li
                key={`${r.kind}-${i}`}
                className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${SEVERITY_CLASS[r.severity]}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="mt-0.5 opacity-80">{r.detail}</p>
                </div>
                {onAction && (
                  <button
                    type="button"
                    onClick={() => onAction(r.kind)}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] hover:bg-background/40"
                  >
                    Corriger
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
