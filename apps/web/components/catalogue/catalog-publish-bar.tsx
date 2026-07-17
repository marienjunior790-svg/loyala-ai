'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { History, Save, Send, Archive, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CatalogPublicationStatus, CatalogSettings, CatalogVersion } from '@loyala/domain-crm';
import {
  setPublicationStatusAction,
  saveCatalogVersionAction,
  restoreCatalogVersionAction,
} from '@/app/(dashboard)/catalogue/_actions/publication';

const STATUS_LABEL: Record<CatalogPublicationStatus, string> = {
  draft: 'Brouillon',
  in_review: 'En révision',
  published: 'Publié',
  archived: 'Archivé',
};

const STATUS_CLASS: Record<CatalogPublicationStatus, string> = {
  draft: 'bg-secondary text-muted-foreground',
  in_review: 'bg-amber-500/15 text-amber-200',
  published: 'bg-emerald-500/15 text-emerald-300',
  archived: 'bg-zinc-500/20 text-zinc-400',
};

export function CatalogPublishBar({
  settings,
  versions,
  canWrite,
  onPreview,
}: {
  settings: CatalogSettings;
  versions: CatalogVersion[];
  canWrite: boolean;
  onPreview?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  function run(fn: () => Promise<{ error?: string; success?: string }>) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? res.success ?? null);
      if (res.success) router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[settings.publication_status]}`}
        >
          {STATUS_LABEL[settings.publication_status]}
        </span>
        {settings.published_at && (
          <span className="text-xs text-muted-foreground">
            Publié le {new Date(settings.published_at).toLocaleString('fr-FR')}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {onPreview && (
            <Button type="button" size="sm" variant="outline" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" />
              Prévisualiser
            </Button>
          )}
          {canWrite && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => saveCatalogVersionAction())}
              >
                <Save className="h-3.5 w-3.5" />
                Snapshot
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setPublicationStatusAction('in_review'))}
              >
                En révision
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm('Publier le catalogue actuel et créer une version ?')) {
                    run(() => setPublicationStatusAction('published'));
                  }
                }}
              >
                <Send className="h-3.5 w-3.5" />
                Publier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setPublicationStatusAction('archived'))}
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <History className="h-3.5 w-3.5" />
                Historique
              </Button>
            </>
          )}
        </div>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      {historyOpen && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
          {versions.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune version pour l’instant
            </p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      v{v.version_number} · {v.label ?? '—'}
                    </p>
                    <p className="text-muted-foreground">
                      {STATUS_LABEL[v.status]} · {new Date(v.created_at).toLocaleString('fr-FR')}
                      {v.summary ? ` · ${v.summary}` : ''}
                    </p>
                  </div>
                  {canWrite && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(
                            `Restaurer la v${v.version_number} ? Les articles existants seront mis à jour (brouillon).`
                          )
                        ) {
                          run(() => restoreCatalogVersionAction(v.id));
                        }
                      }}
                    >
                      Restaurer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
