'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  Share2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CsvImportWizard } from '@/components/clients/csv-import-wizard';
import {
  buildWhatsAppUrl,
  renderAcquisitionMessage,
  type AcquisitionSource,
  type AcquisitionStats,
} from '@loyala/domain-crm';

interface CollectClientsClientProps {
  restaurantName: string;
  whatsappPhone: string;
  sources: AcquisitionSource[];
  stats: AcquisitionStats;
}

export function CollectClientsClient({
  restaurantName,
  whatsappPhone,
  sources,
  stats,
}: CollectClientsClientProps) {
  const [activeSlug, setActiveSlug] = useState(sources[0]?.slug ?? 'qr_caisse');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const active = sources.find((s) => s.slug === activeSlug) ?? sources[0];
  const message = useMemo(() => {
    if (customMessage.trim()) return customMessage.trim();
    const tpl =
      active?.message_template ||
      'Bonjour, je souhaite rejoindre le programme fidélité de {{restaurant}}.';
    const base = renderAcquisitionMessage(tpl, restaurantName);
    const ref = active?.slug ? `\n\n[ref:${active.slug}]` : '';
    return `${base}${ref}`;
  }, [active, customMessage, restaurantName]);

  const waLink = whatsappPhone.trim()
    ? buildWhatsAppUrl(whatsappPhone, message)
    : '';

  const qrUrl = waLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(waLink)}`
    : '';

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied('error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
              Clients
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold tracking-tight">Collecter des clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            QR codes, liens WhatsApp trackables et import CSV — données réelles.
          </p>
        </div>
      </div>

      {!whatsappPhone.trim() && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Configurez votre numéro WhatsApp dans{' '}
            <Link href="/settings" className="text-primary underline">
              Paramètres
            </Link>{' '}
            pour activer les QR et liens.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Cette semaine" value={stats.newThisWeek} />
        <Metric title="Ce mois" value={stats.newThisMonth} />
        <Metric title="Source principale" value={stats.primarySource ?? '—'} isText />
        <Metric title="Contacts en attente" value={stats.pendingLeads} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune attribution pour le moment. Les clients créés via QR / lien / CSV
              renseigneront cette liste.
            </p>
          ) : (
            stats.bySource.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-sm">
                <span className="capitalize">{s.source.replace(/_/g, ' ')}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Méthode 1 — QR code WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Placez ce QR sur vos tables, tickets, menus, emballages ou comptoirs.
            </p>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => {
                    setActiveSlug(s.slug);
                    setCustomMessage('');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeSlug === s.slug
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {qrUrl ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-4">
                <img src={qrUrl} alt={`QR ${active?.label ?? ''}`} className="h-56 w-56 rounded-lg bg-white p-2" />
                <p className="text-sm font-medium">{restaurantName}</p>
                <p className="text-xs text-muted-foreground">{whatsappPhone}</p>
                <p className="text-center text-[11px] text-muted-foreground">
                  Source trackée : {active?.slug}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Numéro WhatsApp manquant.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!qrUrl}
                onClick={() => qrUrl && window.open(qrUrl, '_blank')}
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!waLink}
                onClick={() => waLink && copyText('link', waLink)}
              >
                <Copy className="h-4 w-4" />
                {copied === 'link' ? 'Copié' : 'Copier le lien'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!waLink || typeof navigator.share !== 'function'}
                onClick={() =>
                  waLink &&
                  navigator.share?.({
                    title: restaurantName,
                    text: message,
                    url: waLink,
                  })
                }
              >
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Méthode 2 — Lien WhatsApp intelligent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Message prérempli configurable. Le tag <code>[ref:…]</code> permet d’attribuer la
              source à l’arrivée du message.
            </p>
            <textarea
              value={customMessage || message}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <Input readOnly value={waLink || 'Configurez le numéro WhatsApp'} className="font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!waLink}
                onClick={() => waLink && copyText('smart', waLink)}
              >
                <Copy className="h-4 w-4" />
                {copied === 'smart' ? 'Copié' : 'Copier le lien'}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!waLink} asChild={Boolean(waLink)}>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                    Ouvrir WhatsApp
                  </a>
                ) : (
                  <span>Ouvrir WhatsApp</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Méthode 3 — Importer des clients (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImportWizard />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  title,
  value,
  isText,
}: {
  title: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={`mt-1 font-semibold ${isText ? 'text-lg capitalize' : 'text-3xl tabular-nums'}`}>
          {typeof value === 'string' ? value.replace(/_/g, ' ') : value}
        </p>
      </CardContent>
    </Card>
  );
}
