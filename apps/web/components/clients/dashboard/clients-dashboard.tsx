import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  HeartHandshake,
  Medal,
  Minus,
  Repeat,
  ShoppingBasket,
  Trophy,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  percentChange,
  type ClientDashboard,
  type ClientRank,
  type ClientSegment,
  type DashboardPeriod,
  type DayRange,
  type ProductStat,
} from '@loyala/domain-crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompactMoney, formatMoney } from '@/lib/clients/money';
import { SpendChart, type SpendPoint } from './spend-chart';

function utcDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return utcDate(day).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });
}

function formatRange(range: DayRange) {
  if (range.start === range.end) return formatDay(range.start, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${formatDay(range.start)} – ${formatDay(range.end)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function plural(count: number, word: string) {
  return `${count.toLocaleString('fr-FR')} ${word}${count > 1 ? 's' : ''}`;
}

function Change({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) {
    return <span className="text-xs text-muted-foreground">{current > 0 ? 'nouveau' : '—'}</span>;
  }
  const good = invert ? change < 0 : change > 0;
  const Icon = change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        change === 0 ? 'text-muted-foreground' : good ? 'text-emerald-300' : 'text-red-300'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {change > 0 ? '+' : ''}
      {change} %
    </span>
  );
}

function ClientLink({ row, className }: { row: Pick<ClientRank, 'clientId' | 'name'>; className?: string }) {
  return (
    <Link href={`/clients/${row.clientId}`} className={cn('font-medium hover:text-primary hover:underline', className)}>
      {row.name}
    </Link>
  );
}

// ─── Sélecteur de période ────────────────────────────────────────────────────

export function PeriodSelector({ period }: { period: DashboardPeriod }) {
  return (
    <div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="Période">
      {DASHBOARD_PERIODS.map((value) => (
        <Link
          key={value}
          href={`/clients?periode=${value}`}
          scroll={false}
          aria-current={value === period ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition',
            value === period ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {DASHBOARD_PERIOD_LABELS[value]}
        </Link>
      ))}
    </div>
  );
}

// ─── Indicateurs ─────────────────────────────────────────────────────────────

function KpiGrid({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  const { kpis } = dashboard;
  const cards = [
    {
      icon: Wallet,
      label: 'Dépenses clients',
      value: formatMoney(kpis.revenue, currency),
      change: <Change current={kpis.revenue} previous={kpis.previousRevenue} />,
    },
    {
      icon: Users,
      label: 'Clients servis',
      value: kpis.clientsServed.toLocaleString('fr-FR'),
      change: <Change current={kpis.clientsServed} previous={kpis.previousClientsServed} />,
    },
    {
      icon: ShoppingBasket,
      label: 'Panier moyen',
      value: kpis.averageBasket > 0 ? formatMoney(kpis.averageBasket, currency) : '—',
      change: <Change current={kpis.averageBasket} previous={kpis.previousAverageBasket} />,
    },
    {
      icon: Repeat,
      label: 'Fréquence',
      value: kpis.frequency > 0 ? kpis.frequency.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—',
      change: <span className="text-xs text-muted-foreground">commandes par client</span>,
    },
    {
      icon: UserPlus,
      label: 'Nouveaux clients',
      value: kpis.newClients.toLocaleString('fr-FR'),
      change: <Change current={kpis.newClients} previous={kpis.previousNewClients} />,
    },
    {
      icon: HeartHandshake,
      label: 'Clients revenus',
      value: kpis.returningClients.toLocaleString('fr-FR'),
      change: <span className="text-xs text-muted-foreground">au moins 2 commandes</span>,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs">{card.label}</span>
              </div>
              <p className="truncate text-xl font-semibold tracking-tight">{card.value}</p>
              {card.change}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Podium de la semaine ────────────────────────────────────────────────────

const PODIUM_STYLES = [
  { order: 'sm:order-2', ring: 'ring-amber-300/60 bg-amber-400/15 text-amber-200', lift: 'sm:-mt-3', label: '1er' },
  { order: 'sm:order-1', ring: 'ring-slate-300/50 bg-slate-300/10 text-slate-200', lift: 'sm:mt-4', label: '2e' },
  { order: 'sm:order-3', ring: 'ring-orange-400/50 bg-orange-500/10 text-orange-200', lift: 'sm:mt-6', label: '3e' },
];

function WeekPodium({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  const { podium, range } = dashboard.week;
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-300" />
          Top 3 de la semaine
        </CardTitle>
        <CardDescription>Meilleurs clients depuis lundi ({formatRange(range)})</CardDescription>
      </CardHeader>
      <CardContent>
        {podium.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune commande payée cette semaine.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
            {podium.map((row, index) => {
              const style = PODIUM_STYLES[index];
              return (
                <div
                  key={row.clientId}
                  className={cn('rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center', style.order, style.lift)}
                >
                  <div
                    className={cn(
                      'mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ring-2',
                      style.ring
                    )}
                  >
                    {initials(row.name)}
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {index === 0 ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : <Medal className="h-3.5 w-3.5" />}
                    {style.label}
                  </p>
                  <ClientLink row={row} className="mt-1 block truncate" />
                  <p className="mt-2 text-lg font-semibold">{formatMoney(row.spent, currency)}</p>
                  <p className="text-xs text-muted-foreground">{plural(row.visits, 'commande')}</p>
                  {row.favoriteProduct && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      <UtensilsCrossed className="mr-1 inline h-3 w-3" />
                      {row.favoriteProduct}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Extrêmes du mois ────────────────────────────────────────────────────────

function MonthSpender({
  title,
  row,
  currency,
  tone,
}: {
  title: string;
  row: (ClientRank & { previousSpent: number }) | null;
  currency: string;
  tone: 'top' | 'low';
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      {row ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                tone === 'top' ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-200'
              )}
            >
              {initials(row.name)}
            </div>
            <div className="min-w-0">
              <ClientLink row={row} className="block truncate" />
              <p className="text-xs text-muted-foreground">
                {plural(row.visits, 'commande')}
                {row.averageBasket > 0 && ` · panier ${formatMoney(row.averageBasket, currency)}`}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-semibold">{formatMoney(row.spent, currency)}</p>
            <p className="text-xs text-muted-foreground">
              mois dernier : {formatMoney(row.previousSpent, currency)}{' '}
              <Change current={row.spent} previous={row.previousSpent} />
            </p>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Il faut au moins deux clients venus ce mois-ci.</p>
      )}
    </div>
  );
}

function MonthExtremes({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  const { month } = dashboard;
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Ce mois-ci</CardTitle>
        <CardDescription>
          {month.buyers > 0
            ? `Parmi les ${plural(month.buyers, 'client')} venu${month.buyers > 1 ? 's' : ''} depuis le ${formatDay(month.range.start, { day: 'numeric', month: 'long' })}`
            : 'Aucun client venu ce mois-ci pour le moment'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {month.top ? (
          <>
            <MonthSpender title="Client qui dépense le plus" row={month.top} currency={currency} tone="top" />
            <MonthSpender title="Client qui dépense le moins" row={month.lowest} currency={currency} tone="low" />
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Les classements apparaîtront dès la première commande payée du mois.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Graphique ───────────────────────────────────────────────────────────────

function pointTitle(period: DashboardPeriod, key: string) {
  if (period === 'annee') return utcDate(`${key}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (period === '3mois') return `Semaine du ${formatDay(key, { day: 'numeric', month: 'long' })}`;
  return formatDay(key, { weekday: 'long', day: 'numeric', month: 'long' });
}

function SpendCard({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  const points: SpendPoint[] = dashboard.series.map((point) => ({
    key: point.key,
    label: point.label,
    title: pointTitle(dashboard.period, point.key),
    spent: point.revenue,
    visits: point.visits,
    future: point.future,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dépenses des clients</CardTitle>
        <CardDescription>
          {formatRange(dashboard.range)} · comparé à {formatRange(dashboard.range.previous)} :{' '}
          {formatCompactMoney(dashboard.kpis.previousRevenue, currency)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SpendChart points={points} currency={currency} />
      </CardContent>
    </Card>
  );
}

// ─── Classement ──────────────────────────────────────────────────────────────

function Ranking({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  const rows = dashboard.ranking.slice(0, 10);
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Classement des clients</CardTitle>
        <CardDescription>
          Les plus gros consommateurs · {DASHBOARD_PERIOD_LABELS[dashboard.period].toLowerCase()} en cours
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune dépense client sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Client</th>
                  <th className="py-2 pr-2 text-right font-medium">Dépensé</th>
                  <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">Commandes</th>
                  <th className="hidden py-2 pr-2 text-right font-medium md:table-cell">Panier moyen</th>
                  <th className="hidden py-2 font-medium lg:table-cell">Plat préféré</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.clientId} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-2 text-muted-foreground">{index + 1}</td>
                    <td className="max-w-[10rem] truncate py-2.5 pr-2">
                      <ClientLink row={row} />
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-2 text-right font-medium">
                      {formatMoney(row.spent, currency)}
                    </td>
                    <td className="hidden py-2.5 pr-2 text-right sm:table-cell">{row.visits}</td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-2 text-right md:table-cell">
                      {row.averageBasket > 0 ? formatMoney(row.averageBasket, currency) : '—'}
                    </td>
                    <td className="hidden max-w-[10rem] truncate py-2.5 text-muted-foreground lg:table-cell">
                      {row.favoriteProduct ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export function ProductBars({ products, currency }: { products: ProductStat[]; currency: string }) {
  const max = Math.max(...products.map((product) => product.quantity), 1);
  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <li key={product.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{product.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {product.quantity.toLocaleString('fr-FR')} × · {formatCompactMoney(product.revenue, currency)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(product.quantity / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Catalogue({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          Ce que les clients commandent
        </CardTitle>
        <CardDescription>Plats du catalogue des commandes payées</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {dashboard.topProducts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun plat sur la période. Choisissez les plats du catalogue en enregistrant une commande pour voir les
            préférences de vos clients.
          </p>
        ) : (
          <>
            <ProductBars products={dashboard.topProducts} currency={currency} />
            {dashboard.topCategories.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Catégories</p>
                <div className="flex flex-wrap gap-2">
                  {dashboard.topCategories.map((category) => (
                    <span
                      key={category.name}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs"
                    >
                      {category.name} · {category.quantity.toLocaleString('fr-FR')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Répartition du fichier ──────────────────────────────────────────────────

const SEGMENTS: { id: ClientSegment; label: string; color: string; hint: string }[] = [
  { id: 'vip', label: 'VIP', color: 'bg-amber-400', hint: '500 000 FCFA et plus, venus ces 14 jours' },
  { id: 'regular', label: 'Actifs', color: 'bg-primary', hint: 'Venus ces 14 derniers jours' },
  { id: 'new', label: 'Nouveaux', color: 'bg-sky-400', hint: 'Inscrits, pas encore venus' },
  { id: 'at_risk', label: 'À risque', color: 'bg-orange-500', hint: 'Absents 14 jours, peu de commandes' },
  { id: 'inactive', label: 'Habitués perdus', color: 'bg-red-400', hint: '3 commandes ou plus, absents 14 jours' },
];

function SegmentSplit({ dashboard }: { dashboard: ClientDashboard }) {
  const total = SEGMENTS.reduce((sum, segment) => sum + dashboard.segments[segment.id], 0);
  if (total === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Votre fichier clients</CardTitle>
        <CardDescription>{plural(total, 'client')} · cliquez sur un groupe pour l’ouvrir</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
          {SEGMENTS.map((segment) =>
            dashboard.segments[segment.id] > 0 ? (
              <div
                key={segment.id}
                className={segment.color}
                style={{ width: `${(dashboard.segments[segment.id] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SEGMENTS.map((segment) => (
            <Link
              key={segment.id}
              href={`/clients?vue=fichier&segment=${segment.id}`}
              className="rounded-lg border border-white/[0.08] p-3 transition hover:border-primary/30"
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', segment.color)} />
                {segment.label}
              </span>
              <span className="mt-1 block text-lg font-semibold">
                {dashboard.segments[segment.id].toLocaleString('fr-FR')}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{segment.hint}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

export function ClientsDashboard({ dashboard, currency }: { dashboard: ClientDashboard; currency: string }) {
  return (
    <div className="space-y-6">
      <KpiGrid dashboard={dashboard} currency={currency} />
      <div className="grid gap-6 lg:grid-cols-5">
        <WeekPodium dashboard={dashboard} currency={currency} />
        <MonthExtremes dashboard={dashboard} currency={currency} />
      </div>
      <SpendCard dashboard={dashboard} currency={currency} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Ranking dashboard={dashboard} currency={currency} />
        <Catalogue dashboard={dashboard} currency={currency} />
      </div>
      <SegmentSplit dashboard={dashboard} />
    </div>
  );
}
