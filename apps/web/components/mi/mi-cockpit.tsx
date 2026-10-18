'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiPeriodChip } from '@/components/mi/mi-insights-panel';
import {
  formatChangePct,
  formatMiInsights,
  formatMoney,
  type MiInsightOpportunity,
  type MiInsightRetentionStrategy,
  type MiFormattedInsights,
} from '@/lib/mi/format-insights';
import { insufficientBanner, type MiLocale } from '@/lib/mi/ui-copy';
import type { MiChatApiPeriod } from '@/lib/mi/api-client';
import { cn } from '@/lib/utils';

function qualityVariant(
  q: MiFormattedInsights['dataQuality']
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (q === 'ok') return 'success';
  if (q === 'partial') return 'warning';
  if (q === 'insufficient') return 'destructive';
  return 'secondary';
}

function qualityLabel(q: MiFormattedInsights['dataQuality'], locale: MiLocale): string {
  if (locale === 'en') {
    if (q === 'ok') return 'Data OK';
    if (q === 'partial') return 'Partial data';
    if (q === 'insufficient') return 'Insufficient data';
    return 'Unknown quality';
  }
  if (q === 'ok') return 'Données OK';
  if (q === 'partial') return 'Données partielles';
  if (q === 'insufficient') return 'Données insuffisantes';
  return 'Qualité inconnue';
}

function priorityLabel(
  p: MiInsightOpportunity['priority'] | MiInsightRetentionStrategy['priority'],
  fr: boolean
): string {
  if (p === 'high') return fr ? 'Priorité haute' : 'High priority';
  if (p === 'medium') return fr ? 'Priorité moyenne' : 'Medium priority';
  return fr ? 'Priorité basse' : 'Low priority';
}

function confidenceLabel(c: MiInsightRetentionStrategy['confidence'], fr: boolean): string {
  if (c === 'medium') return fr ? 'Confiance moyenne' : 'Medium confidence';
  return fr ? 'Confiance faible' : 'Low confidence';
}

function formatMetricValue(
  value: number | null,
  unit: string,
  currency: string,
  locale: MiLocale
): string {
  if (value === null) return locale === 'en' ? 'Not established' : 'Non établi';
  if (unit === 'money') return formatMoney(value, currency, locale);
  if (unit === 'ratio') return formatChangePct(value, locale);
  if (unit === 'days') {
    return locale === 'en' ? `${value} d` : `${value} j`;
  }
  if (unit === 'frequency') {
    return value.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR');
}

function TrendDelta({
  pct,
  significant,
  locale,
}: {
  pct: number | null;
  significant: boolean;
  locale: MiLocale;
}) {
  if (pct === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {locale === 'en' ? 'No prior period base' : 'Pas de base de comparaison'}
      </span>
    );
  }
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={cn(
        'text-xs font-medium',
        significant && up && 'text-emerald-300',
        significant && down && 'text-amber-200',
        !significant && 'text-muted-foreground'
      )}
      data-testid="mi-trend-delta"
      data-significant={significant ? '1' : '0'}
    >
      {formatChangePct(pct, locale)}
      {significant
        ? locale === 'en'
          ? ' · significant'
          : ' · significative'
        : locale === 'en'
          ? ' · not significant'
          : ' · non significative'}
    </span>
  );
}

export function MiCockpit({
  insights,
  dataQuality,
  period,
  locale,
  loading,
  error,
}: {
  insights: Record<string, unknown> | null;
  dataQuality: string | null;
  period: MiChatApiPeriod | null;
  locale: MiLocale;
  loading?: boolean;
  error?: string | null;
}) {
  const fr = locale !== 'en';
  const formatted = formatMiInsights(insights ?? {}, dataQuality);

  return (
    <section
      className="space-y-4"
      aria-label={fr ? 'Cockpit Marketing Intelligence' : 'Marketing Intelligence cockpit'}
      data-testid="mi-cockpit"
      aria-busy={loading || false}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          {fr ? 'Cockpit analytique' : 'Analytics cockpit'}
        </h2>
        <Badge variant={qualityVariant(formatted.dataQuality)} data-testid="mi-cockpit-quality">
          {qualityLabel(formatted.dataQuality, locale)}
        </Badge>
        {formatted.restaurantName ? (
          <span className="text-sm text-muted-foreground">{formatted.restaurantName}</span>
        ) : null}
      </div>

      <MiPeriodChip period={period} locale={locale} />

      {error ? (
        <Card className="border-destructive/40" data-testid="mi-cockpit-error" role="alert">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground" data-testid="mi-cockpit-loading">
          {fr ? 'Chargement des indicateurs…' : 'Loading indicators…'}
        </p>
      ) : null}

      {!loading && formatted.dataQuality === 'insufficient' ? (
        <Card className="border-amber-400/30 bg-amber-500/10" data-testid="mi-cockpit-insufficient">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-amber-100">{insufficientBanner(locale)}</p>
            {formatted.limits.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {formatted.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {fr
                  ? 'Ajoutez des commandes payées ou élargissez la période.'
                  : 'Add paid orders or widen the period.'}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading && formatted.dataQuality !== 'insufficient' && formatted.kpis ? (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="mi-cockpit-kpis"
        >
          {(
            [
              [
                'revenue',
                fr ? 'CA période' : 'Period revenue',
                formatted.kpis.revenue,
                true,
                formatted.trends?.revenue,
              ],
              [
                'visits',
                fr ? 'Commandes / visites' : 'Orders / visits',
                formatted.kpis.visits,
                false,
                formatted.trends?.visits,
              ],
              [
                'basket',
                fr ? 'Panier moyen' : 'Avg basket',
                formatted.kpis.averageBasket,
                true,
                formatted.trends?.averageBasket,
              ],
              [
                'clients',
                fr ? 'Clients servis' : 'Clients served',
                formatted.kpis.activeClients,
                false,
                formatted.trends?.clientsServed,
              ],
            ] as const
          ).map(([key, label, value, money, trend]) => (
            <Card key={key}>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pb-4 pt-0">
                <p className="text-xl font-semibold tracking-tight">
                  {money
                    ? formatMoney(value, formatted.currency, locale)
                    : value.toLocaleString(fr ? 'fr-FR' : 'en-US')}
                </p>
                {trend ? (
                  <TrendDelta pct={trend.changePct} significant={trend.significant} locale={locale} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && formatted.dataQuality !== 'insufficient' && formatted.trends ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground" data-testid="mi-cockpit-trend-note">
          {formatted.trends.comparisonNote}{' '}
          {fr
            ? '« Significatif » = variation ≥ 20 % avec volume de visites combiné suffisant.'
            : '“Significant” = ≥ 20% change with enough combined visit volume.'}
        </p>
      ) : null}

      {!loading && formatted.dataQuality !== 'insufficient' && formatted.opportunities.length > 0 ? (
        <div className="space-y-3" data-testid="mi-cockpit-opportunities">
          <h3 className="text-sm font-semibold">
            {fr ? 'Opportunités (règles déterministes)' : 'Opportunities (deterministic rules)'}
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {formatted.opportunities.map((op) => (
              <Card key={op.id} data-testid="mi-opportunity" data-rule={op.ruleId}>
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        op.priority === 'high'
                          ? 'destructive'
                          : op.priority === 'medium'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {priorityLabel(op.priority, fr)}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {op.ruleId}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm leading-snug">{op.suggestedAction}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground/80">{fr ? 'Faits observés' : 'Observed facts'}</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {op.facts.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <p>
                    <span className="font-medium text-foreground/80">{fr ? 'Règle' : 'Rule'}: </span>
                    {op.detectionRule}
                  </p>
                  {op.limits.length > 0 ? (
                    <p>
                      <span className="font-medium text-foreground/80">{fr ? 'Limites' : 'Limits'}: </span>
                      {op.limits.join(' ')}
                    </p>
                  ) : null}
                  {op.period.from && op.period.to ? (
                    <p>
                      {fr ? 'Période' : 'Period'}: {op.period.from.slice(0, 10)} →{' '}
                      {op.period.to.slice(0, 10)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {!loading &&
      formatted.dataQuality !== 'insufficient' &&
      formatted.opportunities.length === 0 &&
      formatted.kpis ? (
        <p className="text-sm text-muted-foreground" data-testid="mi-cockpit-no-ops">
          {fr
            ? 'Aucune opportunité déclenchée pour cette période (seuils non atteints).'
            : 'No opportunity triggered for this period (thresholds not met).'}
        </p>
      ) : null}

      {!loading && formatted.customerIntelligence ? (
        <div className="space-y-3" data-testid="mi-cockpit-customer-intel">
          <h3 className="text-sm font-semibold">
            {fr ? 'Intelligence client' : 'Customer intelligence'}
          </h3>
          {formatted.customerIntelligence.segmentCounts ? (
            <div
              className="flex flex-wrap gap-2 text-xs"
              data-testid="mi-cockpit-segments"
              aria-label={fr ? 'Effectifs segments CRM' : 'CRM segment headcounts'}
            >
              {Object.entries(formatted.customerIntelligence.segmentCounts).map(([key, count]) => (
                <Badge key={key} variant="outline" className="font-mono">
                  {key}: {count}
                </Badge>
              ))}
            </div>
          ) : null}
          {formatted.customerIntelligence.evolutionNote ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground" data-testid="mi-cockpit-evolution-note">
              {formatted.customerIntelligence.evolutionNote}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {formatted.customerIntelligence.metrics.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className="rounded-md border border-border/60 px-3 py-2"
                data-testid="mi-customer-metric"
                data-metric={m.id}
              >
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatMetricValue(m.value, m.unit, formatted.currency, locale)}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {m.periodScope}
                  {m.value === null && m.limits[0] ? ` · ${m.limits[0]}` : null}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && formatted.retentionStrategies.length > 0 ? (
        <div className="space-y-3" data-testid="mi-cockpit-retention">
          <h3 className="text-sm font-semibold">
            {fr ? 'Fidélisation (règles déterministes)' : 'Retention (deterministic rules)'}
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {formatted.retentionStrategies.map((s) => (
              <Card key={s.id} data-testid="mi-retention" data-rule={s.ruleId}>
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        s.priority === 'high'
                          ? 'destructive'
                          : s.priority === 'medium'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {priorityLabel(s.priority, fr)}
                    </Badge>
                    <Badge variant="outline">{confidenceLabel(s.confidence, fr)}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.segmentKey} · n={s.headcount}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm leading-snug">{s.suggestedAction}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground/80">{fr ? 'Objectif' : 'Objective'}: </span>
                    {s.marketingObjective}
                  </p>
                  <p>
                    <span className="font-medium text-foreground/80">{fr ? 'Critères' : 'Criteria'}: </span>
                    {s.selectionCriteria}
                  </p>
                  <div>
                    <p className="font-medium text-foreground/80">{fr ? 'Faits observés' : 'Observed facts'}</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {s.facts.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  {s.limits.length > 0 ? (
                    <p>
                      <span className="font-medium text-foreground/80">{fr ? 'Limites' : 'Limits'}: </span>
                      {s.limits.join(' ')}
                    </p>
                  ) : null}
                  {s.period.from && s.period.to ? (
                    <p>
                      {fr ? 'Période' : 'Period'}: {s.period.from.slice(0, 10)} →{' '}
                      {s.period.to.slice(0, 10)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {!loading &&
      formatted.retentionStrategies.length === 0 &&
      (formatted.customerIntelligence || formatted.dataQuality !== 'insufficient') &&
      (formatted.clientCount ?? 0) > 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="mi-cockpit-no-retention">
          {fr
            ? 'Aucune stratégie de fidélisation déclenchée (segments vides ou critères non atteints).'
            : 'No retention strategy triggered (empty segments or thresholds not met).'}
        </p>
      ) : null}
    </section>
  );
}
