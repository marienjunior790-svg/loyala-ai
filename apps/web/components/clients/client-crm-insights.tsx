import {
  Crown,
  Heart,
  Repeat,
  ShoppingBasket,
  Wallet,
  CalendarClock,
  Tag,
  TrendingUp,
} from 'lucide-react';
import type { ClientPurchaseInsights } from '@loyala/domain-crm';
import { Badge } from '@/components/ui/badge';

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function formatMonth(month: string | null): string {
  if (!month) return '—';
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ClientCrmInsights({ insights }: { insights: ClientPurchaseInsights }) {
  const stats: { icon: typeof Heart; label: string; value: string }[] = [
    {
      icon: Heart,
      label: 'Produit préféré',
      value: insights.favoriteProduct?.name ?? '—',
    },
    {
      icon: Tag,
      label: 'Catégorie préférée',
      value: insights.favoriteCategory?.name ?? '—',
    },
    {
      icon: Repeat,
      label: "Fréquence d'achat",
      value:
        insights.purchaseFrequencyPerMonth > 0
          ? `${insights.purchaseFrequencyPerMonth.toFixed(1)} / mois`
          : '—',
    },
    {
      icon: ShoppingBasket,
      label: 'Panier moyen',
      value: insights.averageBasket > 0 ? formatMoney(insights.averageBasket) : '—',
    },
    {
      icon: Wallet,
      label: 'Total dépensé',
      value: formatMoney(insights.totalSpent),
    },
    {
      icon: TrendingUp,
      label: 'Nombre de visites',
      value: String(insights.visitCount),
    },
    {
      icon: CalendarClock,
      label: 'Dernier achat',
      value: formatDate(insights.lastPurchaseAt),
    },
    {
      icon: Crown,
      label: 'Meilleur mois',
      value: insights.bestMonth ? formatMonth(insights.bestMonth.month) : '—',
    },
  ];

  return (
    <div className="space-y-4">
      {insights.isVipCandidate && (
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="gap-1">
            <Crown className="h-3.5 w-3.5" />
            Client VIP potentiel
          </Badge>
          <span className="text-xs text-muted-foreground">
            Bon candidat pour une relance IA prioritaire.
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-border/60 bg-background p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{s.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
