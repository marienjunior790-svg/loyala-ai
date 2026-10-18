'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatMiInsights,
  formatMoney,
  type MiFormattedInsights,
} from '@/lib/mi/format-insights';
import { insufficientBanner, type MiLocale } from '@/lib/mi/ui-copy';
import type { MiChatApiPeriod } from '@/lib/mi/api-client';
import { segmentLabel } from '@/lib/labels';

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

export function MiPeriodChip({
  period,
  locale,
}: {
  period: MiChatApiPeriod | null;
  locale: MiLocale;
}) {
  if (!period || (!period.from && !period.to && !period.label)) return null;
  const range =
    period.from && period.to
      ? `${period.from.slice(0, 10)} → ${period.to.slice(0, 10)}`
      : null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      data-testid="mi-period-chip"
    >
      <Badge variant="outline">{period.label || period.code || '—'}</Badge>
      {range ? <span>{range}</span> : null}
      {period.definition ? (
        <span className="max-w-xl text-[11px] leading-snug opacity-80">{period.definition}</span>
      ) : null}
      <span className="sr-only">
        {locale === 'en' ? 'Analysis period from API' : 'Période d’analyse renvoyée par l’API'}
      </span>
    </div>
  );
}

export function MiInsightsPanel({
  insights,
  dataQuality,
  period,
  locale,
  toolsUsed,
}: {
  insights: Record<string, unknown> | null;
  dataQuality: string | null;
  period: MiChatApiPeriod | null;
  locale: MiLocale;
  toolsUsed?: string[];
}) {
  const formatted = formatMiInsights(insights ?? {}, dataQuality);
  const fr = locale !== 'en';

  return (
    <section
      className="space-y-4 animate-in fade-in duration-300"
      aria-label={fr ? 'Insights structurés' : 'Structured insights'}
      data-testid="mi-insights-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={qualityVariant(formatted.dataQuality)} data-testid="mi-data-quality">
          {qualityLabel(formatted.dataQuality, locale)}
        </Badge>
        {formatted.restaurantName ? (
          <span className="text-sm text-muted-foreground">{formatted.restaurantName}</span>
        ) : null}
      </div>

      <MiPeriodChip period={period} locale={locale} />

      {formatted.dataQuality === 'insufficient' ? (
        <Card className="border-amber-400/30 bg-amber-500/10" data-testid="mi-insufficient">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-amber-100">{insufficientBanner(locale)}</p>
            {formatted.limits.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {formatted.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.kpis ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="mi-kpis">
          {(
            [
              ['revenue', fr ? 'CA période' : 'Period revenue', formatted.kpis.revenue, true],
              ['visits', fr ? 'Visites' : 'Visits', formatted.kpis.visits, false],
              [
                'basket',
                fr ? 'Panier moyen' : 'Avg basket',
                formatted.kpis.averageBasket,
                true,
              ],
              [
                'active',
                fr ? 'Clients actifs' : 'Active clients',
                formatted.kpis.activeClients,
                false,
              ],
            ] as const
          ).map(([key, label, value, money]) => (
            <Card key={key}>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <p className="text-xl font-semibold tracking-tight">
                  {money ? formatMoney(value, formatted.currency, locale) : value.toLocaleString(fr ? 'fr-FR' : 'en-US')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.topClients.length > 0 ? (
        <Card data-testid="mi-top-clients">
          <CardHeader className="pb-2">
            <CardTitle>{fr ? 'Meilleurs clients' : 'Top clients'}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">{fr ? 'Client' : 'Client'}</th>
                  <th className="pb-2 font-medium">{fr ? 'Dépensé' : 'Spent'}</th>
                  <th className="pb-2 font-medium">{fr ? 'Visites' : 'Visits'}</th>
                  <th className="pb-2 font-medium">{fr ? 'Favori' : 'Favorite'}</th>
                </tr>
              </thead>
              <tbody>
                {formatted.topClients.map((c) => (
                  <tr key={c.clientId} className="border-t border-white/[0.06]">
                    <td className="py-2">
                      <span className="font-medium">{c.displayName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.phoneMasked}</span>
                    </td>
                    <td className="py-2">{formatMoney(c.spent, formatted.currency, locale)}</td>
                    <td className="py-2">{c.visits}</td>
                    <td className="py-2 text-muted-foreground">{c.favoriteProduct ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.topProducts.length > 0 ? (
        <Card data-testid="mi-top-products">
          <CardHeader className="pb-2">
            <CardTitle>{fr ? 'Produits populaires' : 'Popular products'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {formatted.topProducts.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0"
              >
                <span className="font-medium">{p.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {p.quantity} × · {formatMoney(p.revenue, formatted.currency, locale)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.inactiveLoyal.length > 0 ? (
        <Card data-testid="mi-inactive">
          <CardHeader className="pb-2">
            <CardTitle>{fr ? 'Fidèles inactifs / à risque' : 'Inactive / at-risk loyal clients'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {formatted.inactiveLoyal.map((c) => (
              <div
                key={c.clientId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] py-2 last:border-0"
              >
                <div>
                  <span className="font-medium">{c.displayName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.phoneMasked}</span>
                  <Badge variant="secondary" className="ml-2">
                    {segmentLabel(c.segment)}
                  </Badge>
                </div>
                <span className="text-muted-foreground">
                  {formatMoney(c.totalSpent, formatted.currency, locale)} · {c.visitCount}{' '}
                  {fr ? 'visites' : 'visits'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.segments ? (
        <Card data-testid="mi-segments">
          <CardHeader className="pb-2">
            <CardTitle>{fr ? 'Segments' : 'Segments'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(formatted.segments).map(([seg, count]) => (
              <Badge key={seg} variant="outline">
                {segmentLabel(seg)} · {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {formatted.dataQuality !== 'insufficient' && formatted.empty ? (
        <p className="text-sm text-muted-foreground" data-testid="mi-insights-empty">
          {fr
            ? 'Aucun insight structuré dans cette réponse.'
            : 'No structured insights in this response.'}
        </p>
      ) : null}

      {toolsUsed && toolsUsed.length > 0 ? (
        <p className="text-[11px] text-muted-foreground/70">
          {fr ? 'Outils' : 'Tools'}: {toolsUsed.join(', ')}
        </p>
      ) : null}
    </section>
  );
}
