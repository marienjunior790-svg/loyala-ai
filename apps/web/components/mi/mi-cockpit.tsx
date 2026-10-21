'use client';

import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Info,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiPeriodChip } from '@/components/mi/mi-insights-panel';
import { MiCampaignDraftsPanel } from '@/components/mi/mi-campaign-drafts';
import {
  formatChangePct,
  formatMiInsights,
  formatMoney,
  type MiInsightOpportunity,
  type MiInsightRetentionStrategy,
  type MiInsightCustomerMetric,
  type MiFormattedInsights,
} from '@/lib/mi/format-insights';
import { insufficientBanner, type MiLocale } from '@/lib/mi/ui-copy';
import type { MiChatApiPeriod } from '@/lib/mi/api-client';
import { cn } from '@/lib/utils';

const SEGMENT_META: Record<
  string,
  { fr: string; en: string; tone: string }
> = {
  new: { fr: 'Nouveaux', en: 'New', tone: 'bg-sky-400' },
  regular: { fr: 'Réguliers', en: 'Regular', tone: 'bg-emerald-400' },
  vip: { fr: 'VIP', en: 'VIP', tone: 'bg-amber-300' },
  inactive: { fr: 'Inactifs', en: 'Inactive', tone: 'bg-zinc-400' },
  at_risk: { fr: 'À risque', en: 'At risk', tone: 'bg-rose-400' },
};

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
  if (p === 'high') return fr ? 'Haute' : 'High';
  if (p === 'medium') return fr ? 'Moyenne' : 'Medium';
  return fr ? 'Basse' : 'Low';
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
): { display: string; empty: boolean } {
  if (value === null) {
    return { display: locale === 'en' ? 'Not established' : 'Non établi', empty: true };
  }
  if (unit === 'money') return { display: formatMoney(value, currency, locale), empty: false };
  if (unit === 'ratio') return { display: formatChangePct(value, locale), empty: false };
  if (unit === 'days') {
    return { display: locale === 'en' ? `${value} d` : `${value} j`, empty: false };
  }
  if (unit === 'frequency') {
    return {
      display: value.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
        maximumFractionDigits: 2,
      }),
      empty: false,
    };
  }
  return {
    display: value.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR'),
    empty: false,
  };
}

function scopeLabel(scope: string, fr: boolean): string {
  if (scope === 'point_in_time') return fr ? 'Instantané' : 'Point in time';
  if (scope === 'selected_period') return fr ? 'Période' : 'Period';
  if (scope === 'lifetime_aggregate') return fr ? 'Lifetime' : 'Lifetime';
  return scope;
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
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
      <span className="text-[11px] text-muted-foreground">
        {locale === 'en' ? 'No prior base' : 'Pas de base'}
      </span>
    );
  }
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        significant && up && 'bg-emerald-500/15 text-emerald-300',
        significant && down && 'bg-amber-500/15 text-amber-200',
        !significant && 'bg-white/[0.04] text-muted-foreground'
      )}
      data-testid="mi-trend-delta"
      data-significant={significant ? '1' : '0'}
    >
      {formatChangePct(pct, locale)}
      {significant
        ? locale === 'en'
          ? ' · significant'
          : ' · significative'
        : null}
    </span>
  );
}

function SegmentDistribution({
  counts,
  locale,
}: {
  counts: Record<string, number>;
  locale: MiLocale;
}) {
  const fr = locale !== 'en';
  const entries = Object.entries(counts);
  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="space-y-3" data-testid="mi-cockpit-segments" aria-label={fr ? 'Effectifs segments CRM' : 'CRM segment headcounts'}>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/5">
        {total > 0
          ? entries.map(([key, count]) => {
              if (count <= 0) return null;
              const meta = SEGMENT_META[key];
              return (
                <div
                  key={key}
                  className={cn('h-full transition-all', meta?.tone ?? 'bg-primary')}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${meta ? (fr ? meta.fr : meta.en) : key}: ${count}`}
                />
              );
            })
          : (
            <div className="h-full w-full bg-white/[0.04]" />
          )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {entries.map(([key, count]) => {
          const meta = SEGMENT_META[key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/[0.06]"
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', meta?.tone ?? 'bg-primary')} aria-hidden />
                {meta ? (fr ? meta.fr : meta.en) : key}
              </span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {count}
                <span className="ml-1 font-normal text-muted-foreground">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MetricTile({
  metric,
  currency,
  locale,
  featured,
}: {
  metric: MiInsightCustomerMetric;
  currency: string;
  locale: MiLocale;
  featured?: boolean;
}) {
  const fr = locale !== 'en';
  const { display, empty } = formatMetricValue(metric.value, metric.unit, currency, locale);
  const tip = [metric.inclusionRules, metric.limits[0]].filter(Boolean).join(' · ');

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl p-4 transition-colors',
        featured
          ? 'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/30 sm:col-span-2'
          : 'bg-white/[0.035] ring-1 ring-white/[0.07] hover:bg-white/[0.05]'
      )}
      data-testid="mi-customer-metric"
      data-metric={metric.id}
      title={tip || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {metric.label}
        </p>
        <span className="shrink-0 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-white/5">
          {scopeLabel(metric.periodScope, fr)}
        </span>
      </div>
      <div className="mt-3">
        <p
          className={cn(
            'font-semibold tracking-tight tabular-nums',
            featured ? 'text-3xl sm:text-4xl' : 'text-2xl',
            empty ? 'text-muted-foreground/70' : 'text-foreground'
          )}
        >
          {empty ? '—' : display}
        </p>
        {empty ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {display}
            {metric.limits[0] ? (
              <span className="block truncate opacity-80" title={metric.limits[0]}>
                {metric.limits[0]}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {scopeLabel(metric.periodScope, fr)}
            {metric.zeroMeans ? ` · ${metric.zeroMeans.slice(0, 48)}${metric.zeroMeans.length > 48 ? '…' : ''}` : null}
          </p>
        )}
      </div>
    </div>
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
  const intel = formatted.customerIntelligence;
  const primaryMetric = intel?.metrics.find((m) => m.id === 'median_recency_days');
  const otherMetrics = intel?.metrics.filter((m) => m.id !== 'median_recency_days').slice(0, 7) ?? [];
  const [briefingExpanded, setBriefingExpanded] = React.useState(false);
  const briefingItems = formatted.proactiveBriefing?.items ?? [];
  const briefingVisible = briefingExpanded ? briefingItems : briefingItems.slice(0, 6);
  const briefingHidden = Math.max(0, briefingItems.length - 6);

  const reviewsCompleteLabel = (() => {
    const r = formatted.reviewsInsight;
    if (!r) return null;
    if (r.sampleComplete === true) return fr ? 'Échantillon complet' : 'Complete sample';
    if (r.sampleComplete === false) return fr ? 'Échantillon tronqué' : 'Truncated sample';
    return fr ? 'Complétude incertaine' : 'Completeness unknown';
  })();

  return (
    <section
      className="space-y-6"
      aria-label={fr ? 'Cockpit Marketing Intelligence' : 'Marketing Intelligence cockpit'}
      data-testid="mi-cockpit"
      aria-busy={loading || false}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary/80">
            Marketing Intelligence
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {fr ? 'Cockpit analytique' : 'Analytics cockpit'}
            </h2>
            <Badge variant={qualityVariant(formatted.dataQuality)} data-testid="mi-cockpit-quality">
              {qualityLabel(formatted.dataQuality, locale)}
            </Badge>
          </div>
          {formatted.restaurantName ? (
            <p className="text-sm text-muted-foreground">{formatted.restaurantName}</p>
          ) : null}
        </div>
        <MiPeriodChip period={period} locale={locale} />
      </div>

      {!loading && formatted.measurementWindows.length > 0 ? (
        <div
          className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]"
          data-testid="mi-measurement-windows"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {fr ? 'Fenêtres de mesure (distinctes)' : 'Measurement windows (distinct)'}
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {formatted.measurementWindows.map((w) => (
              <li key={w.id} className="text-[11px] text-muted-foreground" data-window={w.id}>
                <span className="font-medium text-foreground/90">{w.label}</span>
                <span className="mt-0.5 block font-mono text-[10px] opacity-80">
                  {w.from} → {w.to}
                  {w.alignedWithDashboard
                    ? fr
                      ? ' · alignée dashboard'
                      : ' · dashboard-aligned'
                    : fr
                      ? ' · glissante (≠ dashboard)'
                      : ' · sliding (≠ dashboard)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading &&
      (formatted.channelMix ||
        formatted.reviewsInsight ||
        formatted.recencyLoyalty ||
        formatted.campaignActivity) ? (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="mi-extended-signals"
        >
          <div
            className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
            data-testid="mi-signal-delivery"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {fr ? 'Livraison (P2.3)' : 'Delivery (P2.3)'}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatted.channelMix?.deliverySharePct != null
                ? `${formatted.channelMix.deliverySharePct} %`
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatted.channelMix?.deliverySharePct != null
                ? fr
                  ? `Couverture order_type ${formatted.channelMix.coveragePct ?? '?'} %`
                  : `order_type coverage ${formatted.channelMix.coveragePct ?? '?'} %`
                : formatted.channelMix?.limitations[0] ??
                  (fr ? 'Part non publiable' : 'Share unavailable')}
            </p>
          </div>
          <div
            className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
            data-testid="mi-signal-reviews"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {fr ? 'Avis (P2.4)' : 'Reviews (P2.4)'}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatted.reviewsInsight?.averageRating != null
                ? `${formatted.reviewsInsight.averageRating}/5`
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatted.reviewsInsight
                ? `${formatted.reviewsInsight.ratedCount} ${fr ? 'notés' : 'rated'}${
                    reviewsCompleteLabel ? ` · ${reviewsCompleteLabel}` : ''
                  }`
                : fr
                  ? 'Avis indisponibles'
                  : 'Reviews unavailable'}
            </p>
            {formatted.reviewsInsight?.sampleComplete !== true &&
            formatted.reviewsInsight?.averageRating != null ? (
              <p className="mt-1 text-[10px] text-amber-200/90">
                {fr
                  ? 'Moyenne non exhaustive (échantillon)'
                  : 'Non-exhaustive average (sample)'}
              </p>
            ) : null}
          </div>
          <div
            className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
            data-testid="mi-signal-recency"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {fr ? 'Récence (P2.5)' : 'Recency (P2.5)'}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatted.recencyLoyalty?.repeatRate60dPct != null
                ? `${formatted.recencyLoyalty.repeatRate60dPct} %`
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatted.recencyLoyalty
                ? fr
                  ? `Inactifs réguliers ${formatted.recencyLoyalty.formerlyRegularInactiveCount} · at_risk ${formatted.recencyLoyalty.atRiskCount}`
                  : `Formerly regular inactive ${formatted.recencyLoyalty.formerlyRegularInactiveCount} · at_risk ${formatted.recencyLoyalty.atRiskCount}`
                : fr
                  ? 'Récence indisponible'
                  : 'Recency unavailable'}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">
              {fr ? 'Fenêtre 120 j glissante (≠ dashboard)' : '120d sliding window (≠ dashboard)'}
            </p>
          </div>
          <div
            className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
            data-testid="mi-signal-campaigns"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {fr ? 'Campagnes (P2.6)' : 'Campaigns (P2.6)'}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatted.campaignActivity
                ? formatted.campaignActivity.sendsInPeriod
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatted.campaignActivity
                ? fr
                  ? `${formatted.campaignActivity.campaignsInPeriod} camp. · pending ${formatted.campaignActivity.pendingCount} · sent ${formatted.campaignActivity.sentCount}`
                  : `${formatted.campaignActivity.campaignsInPeriod} camp. · pending ${formatted.campaignActivity.pendingCount} · sent ${formatted.campaignActivity.sentCount}`
                : fr
                  ? 'Activité indisponible'
                  : 'Activity unavailable'}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">
              {formatted.campaignActivity?.markedSentRatePct != null
                ? fr
                  ? `Marquage sent ${formatted.campaignActivity.markedSentRatePct} % (≠ delivery WhatsApp)`
                  : `Marked-sent ${formatted.campaignActivity.markedSentRatePct} % (≠ WhatsApp delivery)`
                : fr
                  ? 'Pas de ROI / opens CRM'
                  : 'No CRM ROI / opens'}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200"
          data-testid="mi-cockpit-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-4 py-6 text-sm text-muted-foreground ring-1 ring-white/[0.06]"
          data-testid="mi-cockpit-loading"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          {fr ? 'Chargement des indicateurs…' : 'Loading indicators…'}
        </div>
      ) : null}

      {!loading && formatted.proactiveBriefing ? (
        <div
          className="space-y-3 rounded-2xl bg-gradient-to-b from-primary/[0.07] to-transparent p-5 ring-1 ring-primary/20"
          data-testid="mi-cockpit-proactive-briefing"
          data-status={formatted.proactiveBriefing.status}
        >
          <SectionHeader
            icon={Target}
            title={fr ? 'Briefing proactif' : 'Proactive briefing'}
            subtitle={
              fr
                ? 'Signaux CRM agrégés — faits, limites et actions suggérées (aucun envoi).'
                : 'Aggregated CRM signals — facts, limits and suggested actions (no sends).'
            }
          />
          <p className="text-sm text-foreground/90" data-testid="mi-briefing-summary">
            {formatted.proactiveBriefing.summary}
          </p>
          <p className="text-[11px] text-muted-foreground">{formatted.proactiveBriefing.executionNote}</p>
          {briefingItems.length > 0 ? (
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                {briefingVisible.map((item) => (
                  <Card
                    key={item.id}
                    className="border-white/[0.08] bg-white/[0.03] shadow-none"
                    data-testid="mi-briefing-item"
                    data-family={item.familyKey}
                    data-origin={item.dataOrigin}
                  >
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            item.priority === 'high'
                              ? 'destructive'
                              : item.priority === 'medium'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {priorityLabel(item.priority, fr)}
                        </Badge>
                        <Badge variant="outline">{item.kind}</Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.familyKey}
                        </span>
                      </div>
                      <CardTitle className="text-sm font-medium leading-snug">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      {item.evidence.slice(0, 4).map((e) => (
                        <p key={e} className="flex gap-2">
                          <span className="text-primary/70">·</span>
                          <span>{e}</span>
                        </p>
                      ))}
                      {item.interpretation ? (
                        <p className="text-[11px] leading-relaxed">{item.interpretation}</p>
                      ) : null}
                      {item.recommendedActions[0] ? (
                        <p className="text-[11px] text-foreground/80">
                          {fr ? 'Action :' : 'Action:'} {item.recommendedActions[0]}
                        </p>
                      ) : null}
                      {item.successMetric ? (
                        <p className="text-[11px]">
                          {fr ? 'Succès :' : 'Success:'} {item.successMetric}
                        </p>
                      ) : null}
                      <p className="font-mono text-[10px] opacity-70">
                        {item.source} · {item.dataOrigin} · {confidenceLabel(item.confidence, fr)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {briefingHidden > 0 ? (
                <button
                  type="button"
                  className="text-[11px] text-primary underline-offset-2 hover:underline"
                  data-testid="mi-briefing-expand"
                  onClick={() => setBriefingExpanded((v) => !v)}
                >
                  {briefingExpanded
                    ? fr
                      ? 'Réduire le briefing'
                      : 'Collapse briefing'
                    : fr
                      ? `Voir ${briefingHidden} signal(s) supplémentaire(s)`
                      : `Show ${briefingHidden} more signal(s)`}
                </button>
              ) : null}
            </div>
          ) : null}
          {formatted.proactiveBriefing.missingForBetterBriefing.length > 0 ? (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">
                {fr ? 'Données qui amélioreraient le briefing' : 'Data that would improve the briefing'}
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {formatted.proactiveBriefing.missingForBetterBriefing.slice(0, 6).map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {!loading && formatted.dataQuality === 'insufficient' ? (
        <div
          className="relative overflow-hidden rounded-2xl bg-amber-500/[0.08] px-5 py-4 ring-1 ring-amber-400/25"
          data-testid="mi-cockpit-insufficient"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-50">{insufficientBanner(locale)}</p>
              {formatted.limits.length > 0 ? (
                <ul className="space-y-1 text-muted-foreground">
                  {formatted.limits.map((l) => (
                    <li key={l} className="flex gap-2">
                      <span className="text-amber-400/70">·</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  {fr
                    ? 'Ajoutez des commandes payées ou élargissez la période.'
                    : 'Add paid orders or widen the period.'}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && formatted.dataQuality !== 'insufficient' && formatted.kpis ? (
        <div className="space-y-3">
          <SectionHeader
            icon={BarChart3}
            title={fr ? 'Performance période' : 'Period performance'}
            subtitle={
              fr
                ? 'Indicateurs alignés sur le dashboard CRM — aucune estimation inventée.'
                : 'Metrics aligned with the CRM dashboard — nothing invented.'
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="mi-cockpit-kpis">
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
              <div
                key={key}
                className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.05]"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {money
                    ? formatMoney(value, formatted.currency, locale)
                    : value.toLocaleString(fr ? 'fr-FR' : 'en-US')}
                </p>
                {trend ? (
                  <div className="mt-2">
                    <TrendDelta pct={trend.changePct} significant={trend.significant} locale={locale} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {formatted.trends ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground" data-testid="mi-cockpit-trend-note">
              {formatted.trends.comparisonNote}{' '}
              {fr
                ? '« Significatif » = variation ≥ 20 % avec volume de visites combiné suffisant.'
                : '“Significant” = ≥ 20% change with enough combined visit volume.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && formatted.dataQuality !== 'insufficient' && formatted.opportunities.length > 0 ? (
        <div className="space-y-3" data-testid="mi-cockpit-opportunities">
          <SectionHeader
            icon={Sparkles}
            title={fr ? 'Opportunités' : 'Opportunities'}
            subtitle={fr ? 'Règles déterministes — pas de causalité inventée.' : 'Deterministic rules — no invented causality.'}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {formatted.opportunities.map((op) => (
              <Card
                key={op.id}
                className="border-white/[0.08] bg-white/[0.03] shadow-none"
                data-testid="mi-opportunity"
                data-rule={op.ruleId}
              >
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
                    <span className="font-mono text-[10px] text-muted-foreground">{op.ruleId}</span>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{op.suggestedAction}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <ul className="space-y-1">
                    {op.facts.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-primary/70">·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {op.limits[0] ? (
                    <p className="flex gap-1.5 text-[11px] text-muted-foreground/80">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {op.limits[0]}
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

      {!loading && intel ? (
        <div
          className="space-y-5 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent p-5 ring-1 ring-white/[0.08]"
          data-testid="mi-cockpit-customer-intel"
        >
          <SectionHeader
            icon={Users}
            title={fr ? 'Intelligence client' : 'Customer intelligence'}
            subtitle={
              fr
                ? 'Portrait CRM temps réel — segments et métriques calculés, pas estimés.'
                : 'Live CRM portrait — computed segments and metrics, not estimates.'
            }
          />

          {intel.segmentCounts ? (
            <SegmentDistribution counts={intel.segmentCounts} locale={locale} />
          ) : null}

          {intel.evolutionNote ? (
            <details
              className="group rounded-lg bg-black/20 ring-1 ring-white/[0.06]"
              data-testid="mi-cockpit-evolution-note"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-primary/70" aria-hidden />
                  {fr
                    ? 'Limite données — évolution historique des segments indisponible'
                    : 'Data limit — historical segment evolution unavailable'}
                  <span className="text-muted-foreground/60 group-open:hidden">{fr ? '(détails)' : '(details)'}</span>
                </span>
              </summary>
              <p className="border-t border-white/[0.05] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {intel.evolutionNote}
              </p>
            </details>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {primaryMetric ? (
              <MetricTile
                metric={primaryMetric}
                currency={formatted.currency}
                locale={locale}
                featured
              />
            ) : null}
            {otherMetrics.map((m) => (
              <MetricTile
                key={m.id}
                metric={m}
                currency={formatted.currency}
                locale={locale}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && formatted.retentionStrategies.length > 0 ? (
        <div className="space-y-3" data-testid="mi-cockpit-retention">
          <SectionHeader
            icon={Target}
            title={fr ? 'Fidélisation' : 'Retention'}
            subtitle={
              fr
                ? 'Actions suggérées selon les segments réels — brouillons, pas d’envoi.'
                : 'Suggested actions from real segments — drafts only, no send.'
            }
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {formatted.retentionStrategies.map((s) => (
              <Card
                key={s.id}
                className="border-white/[0.08] bg-white/[0.03] shadow-none"
                data-testid="mi-retention"
                data-rule={s.ruleId}
              >
                <CardHeader className="space-y-3 pb-2">
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
                    <Badge variant="outline" className="border-white/10">
                      {confidenceLabel(s.confidence, fr)}
                    </Badge>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{s.headcount}</span>{' '}
                      {SEGMENT_META[s.segmentKey]
                        ? fr
                          ? SEGMENT_META[s.segmentKey]!.fr.toLowerCase()
                          : SEGMENT_META[s.segmentKey]!.en.toLowerCase()
                        : s.segmentKey}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{s.suggestedAction}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    <span className="text-foreground/75">{fr ? 'Objectif' : 'Objective'} · </span>
                    {s.marketingObjective}
                  </p>
                  <ul className="space-y-1">
                    {s.facts.slice(0, 3).map((f) => (
                      <li key={f} className="flex gap-2">
                        <Activity className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {s.limits[0] ? (
                    <p className="flex gap-1.5 text-[11px] opacity-80">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {s.limits[0]}
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

      {!loading ? (
        <MiCampaignDraftsPanel proposals={formatted.campaignProposals} locale={locale} />
      ) : null}
    </section>
  );
}
