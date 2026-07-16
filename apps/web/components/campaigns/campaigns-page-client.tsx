'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Cake,
  Copy,
  Pencil,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WorkerIntegrationStatus } from '@/components/worker/worker-integration-status';
import {
  generateInactiveCampaignAction,
  generateBirthdayCampaignAction,
  type ModuleActionState,
} from '@/app/(dashboard)/_actions/modules';
import {
  createCampaignAction,
  updateCampaignAction,
  deleteCampaignAction,
  toggleCampaignStatusAction,
  scheduleCampaignAction,
  duplicateCampaignAction,
  type CampaignCrudState,
} from '@/app/(dashboard)/campaigns/_actions/campaigns';
import type { Campaign } from '@loyala/domain-crm';
import type { AutomationStatus } from '@/lib/worker/automation-status';

const initialModule: ModuleActionState = {};
const initialCrud: CampaignCrudState = {};

interface CampaignsPageClientProps {
  campaigns: Campaign[];
  automationStatus: AutomationStatus;
  error?: string | null;
  canWrite?: boolean;
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'ready':
    case 'scheduled':
      return 'success';
    case 'paused':
    case 'draft':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'completed':
      return 'default';
    default:
      return 'warning';
  }
}

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignsPageClient({
  campaigns,
  automationStatus,
  error,
  canWrite = false,
}: CampaignsPageClientProps) {
  const [inactiveState, inactiveAction, inactivePending] = useActionState(
    generateInactiveCampaignAction,
    initialModule
  );
  const [birthdayState, birthdayAction, birthdayPending] = useActionState(
    generateBirthdayCampaignAction,
    initialModule
  );
  const [createState, createAction, createPending] = useActionState(
    createCampaignAction,
    initialCrud
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateCampaignAction,
    initialCrud
  );
  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    scheduleCampaignAction,
    initialCrud
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runMutation(fn: () => Promise<CampaignCrudState>) {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setActionError(result.error);
      if (result.success) {
        setActionSuccess(result.success);
        setEditingId(null);
        setSchedulingId(null);
      }
    });
  }

  const editing = campaigns.find((c) => c.id === editingId) ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive break-words">{error}</CardContent>
        </Card>
      )}

      {(actionError || createState.error || updateState.error || scheduleState.error) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive break-words">
            {actionError || createState.error || updateState.error || scheduleState.error}
          </CardContent>
        </Card>
      )}

      {(actionSuccess || createState.success || updateState.success || scheduleState.success) && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 text-sm text-emerald-400">
            {actionSuccess || createState.success || updateState.success || scheduleState.success}
          </CardContent>
        </Card>
      )}

      <WorkerIntegrationStatus status={automationStatus} />

      {!canWrite && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-200">
            Votre compte est en lecture seule (<strong>Viewer</strong>). Seuls Owner, Admin,
            Manager et Staff peuvent générer des campagnes. Demandez une élévation de rôle dans
            Administration.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Relance inactifs — IA + WhatsApp</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Messages personnalisés pour clients inactifs (14+ jours). Envoi via Relances.
            </p>
            <form action={inactiveAction}>
              <Button type="submit" disabled={inactivePending || !canWrite}>
                {inactivePending ? 'Génération...' : 'Générer des relances pour inactifs'}
              </Button>
            </form>
            {inactiveState.error && (
              <p className="text-sm text-destructive break-words">{inactiveState.error}</p>
            )}
            {inactiveState.success && (
              <p className="text-sm text-emerald-400">{inactiveState.success}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Cake className="h-4 w-4" />
              <span className="text-sm font-medium">Anniversaires du jour</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Campagne automatique (cron 08h UTC) ou déclenchement manuel ici.
            </p>
            <form action={birthdayAction}>
              <Button type="submit" variant="outline" disabled={birthdayPending || !canWrite}>
                {birthdayPending ? 'Génération...' : 'Générer anniversaires'}
              </Button>
            </form>
            {birthdayState.error && (
              <p className="text-sm text-destructive break-words">{birthdayState.error}</p>
            )}
            {birthdayState.success && (
              <p className="text-sm text-emerald-400">{birthdayState.success}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Nouvelle campagne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-1">
                <span className="text-muted-foreground">Nom</span>
                <input
                  name="name"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Promo week-end"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Type</span>
                <select
                  name="type"
                  defaultValue="manual"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="manual">Manuelle</option>
                  <option value="inactive">Inactifs</option>
                  <option value="birthday">Anniversaire</option>
                  <option value="loyalty">Fidélité</option>
                  <option value="promotion">Promotion</option>
                </select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Message (aperçu)</span>
                <textarea
                  name="messagePreview"
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Bonjour {prénom}, ..."
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Planification (optionnel)</span>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Création...' : 'Créer la campagne'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">Historique campagnes</h3>
        <Button variant="outline" size="sm" asChild>
          <Link href="/relances">
            Voir relances
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune campagne pour le moment. Créez-en une ou générez une relance IA.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const isActive = c.status === 'ready' || c.status === 'scheduled';
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{c.type}</Badge>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      {c.scheduled_at && (
                        <Badge variant="outline">
                          {new Date(c.scheduled_at).toLocaleString('fr-FR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          runMutation(() => toggleCampaignStatusAction(c.id, !isActive))
                        }
                      >
                        {isActive ? (
                          <>
                            <Pause className="h-3.5 w-3.5" /> Désactiver
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" /> Activer
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setSchedulingId(schedulingId === c.id ? null : c.id)}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        Planifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => runMutation(() => duplicateCampaignAction(c.id))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Dupliquer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            typeof window !== 'undefined' &&
                            !window.confirm(`Supprimer la campagne « ${c.name} » ?`)
                          ) {
                            return;
                          }
                          runMutation(() => deleteCampaignAction(c.id));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    {c.target_count} destinataires
                    {c.message_preview ? ` · ${c.message_preview}` : ''}
                  </p>

                  {editing && editing.id === c.id && (
                    <form action={updateAction} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                      <input type="hidden" name="campaignId" value={c.id} />
                      <label className="space-y-1 text-sm">
                        <span>Nom</span>
                        <input
                          name="name"
                          required
                          defaultValue={c.name}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Type</span>
                        <select
                          name="type"
                          defaultValue={c.type}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="manual">Manuelle</option>
                          <option value="inactive">Inactifs</option>
                          <option value="birthday">Anniversaire</option>
                          <option value="loyalty">Fidélité</option>
                          <option value="promotion">Promotion</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm sm:col-span-2">
                        <span>Message</span>
                        <textarea
                          name="messagePreview"
                          rows={3}
                          defaultValue={c.message_preview ?? ''}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <Button type="submit" size="sm" disabled={updatePending}>
                          {updatePending ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </form>
                  )}

                  {schedulingId === c.id && (
                    <form
                      action={scheduleAction}
                      className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end"
                    >
                      <input type="hidden" name="campaignId" value={c.id} />
                      <label className="flex-1 space-y-1 text-sm">
                        <span>Date / heure</span>
                        <input
                          type="datetime-local"
                          name="scheduledAt"
                          required
                          defaultValue={toLocalInputValue(c.scheduled_at)}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </label>
                      <Button type="submit" size="sm" disabled={schedulePending}>
                        {schedulePending ? '...' : 'Enregistrer la date'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
