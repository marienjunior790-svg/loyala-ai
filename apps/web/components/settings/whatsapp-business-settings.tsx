'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  connectWhatsAppBusinessAction,
  disconnectWhatsAppBusinessAction,
  testWhatsAppBusinessAction,
  type WhatsAppSettingsState,
} from '@/app/(dashboard)/settings/_actions/whatsapp';
import type { WhatsAppConnectionPublic } from '@loyala/domain-crm';
import { whatsAppStatusCopy, type GuidedWhatsAppSignup } from '@/lib/whatsapp/guided-signup';

const initial: WhatsAppSettingsState = {};

interface WhatsAppBusinessSettingsProps {
  connection: WhatsAppConnectionPublic;
  canManage: boolean;
  /** Hide admin technical IDs for staff; show for owner/admin. */
  showAdminIds?: boolean;
  guidedSignup: GuidedWhatsAppSignup;
}

export function WhatsAppBusinessSettings({
  connection: initialConnection,
  canManage,
  showAdminIds = false,
  guidedSignup,
}: WhatsAppBusinessSettingsProps) {
  const [connection, setConnection] = useState(initialConnection);
  const [state, action, pending] = useActionState(
    async (prev: WhatsAppSettingsState, formData: FormData) => {
      const res = await connectWhatsAppBusinessAction(prev, formData);
      if (res.connection) setConnection(res.connection);
      return res;
    },
    initial
  );
  const [busy, start] = useTransition();
  const [flash, setFlash] = useState<WhatsAppSettingsState>({});
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const ready = connection.isReady;
  const statusCopy = whatsAppStatusCopy(connection);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-400" />
          WhatsApp Business
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready ? (
          <>
            <p className="text-sm font-medium">{statusCopy.title}</p>
            <p className="text-sm text-muted-foreground">{statusCopy.message}</p>
            <p className="text-xs text-muted-foreground">
              Chaque restaurant connecte son propre compte. Aucun numéro n’est partagé entre restaurants.
            </p>
            {connection.lastError && (
              <p className="text-xs text-destructive">{connection.lastError}</p>
            )}
            {canManage && (
              <Button type="button" onClick={() => setShowGuide(true)}>
                Connecter mon WhatsApp
              </Button>
            )}
            {showGuide && canManage && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium">Connexion guidée</p>
                <p className="text-sm text-muted-foreground">{guidedSignup.message}</p>
                {!guidedSignup.canLaunch && (
                  <p className="text-xs text-muted-foreground">
                    En attendant, un responsable peut enregistrer les identifiants Meta déjà
                    obtenus pour ce restaurant via la configuration avancée.
                  </p>
                )}
                <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
                  Configuration avancée
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-emerald-400">{statusCopy.title}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Nom du compte</dt>
                <dd>{connection.accountName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Numéro</dt>
                <dd>{connection.displayPhone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">État</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connection.status === 'connected'
                        ? 'bg-emerald-400'
                        : connection.status === 'error' || connection.status === 'token_expired'
                          ? 'bg-destructive'
                          : 'bg-amber-400'
                    }`}
                  />
                  {connection.statusLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Dernière synchronisation</dt>
                <dd>
                  {connection.lastSyncedAt
                    ? new Date(connection.lastSyncedAt).toLocaleString('fr-FR')
                    : '—'}
                </dd>
              </div>
              {showAdminIds && (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">Business Account ID</dt>
                    <dd className="font-mono text-xs">{connection.wabaId || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone Number ID</dt>
                    <dd className="font-mono text-xs">{connection.phoneNumberId || '—'}</dd>
                  </div>
                </>
              )}
            </dl>
            {connection.lastError && (
              <p className="text-xs text-destructive">{connection.lastError}</p>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const res = await testWhatsAppBusinessAction();
                      if (res.connection) setConnection(res.connection);
                      setFlash(res);
                    })
                  }
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Tester
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
                  Configuration avancée
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const res = await disconnectWhatsAppBusinessAction();
                      if (res.connection) setConnection(res.connection);
                      setFlash(res);
                      setShowForm(false);
                    })
                  }
                >
                  Déconnecter
                </Button>
              </div>
            )}
          </>
        )}

        {showForm && canManage && (
          <form action={action} className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <p className="text-sm font-medium">Configuration avancée</p>
            <p className="text-xs text-muted-foreground">
              Réservé à un responsable qui dispose déjà des identifiants Meta de ce restaurant.
              Le jeton est chiffré côté serveur et n’est plus réaffiché ensuite. Loyala vérifie le
              compte avant de le marquer opérationnel.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Nom du compte (optionnel)</label>
              <Input name="accountName" placeholder="Restaurant …" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Numéro affiché</label>
              <Input
                name="displayPhone"
                required
                placeholder="+24206…"
                defaultValue={connection.displayPhone ?? ''}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone number ID</label>
              <Input
                name="phoneNumberId"
                required
                placeholder="123456789012345"
                defaultValue={connection.phoneNumberId ?? ''}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">WhatsApp Business Account ID</label>
              <Input
                name="wabaId"
                required
                placeholder="123456789012345"
                defaultValue={connection.wabaId ?? ''}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Access token Meta</label>
              <Input
                name="accessToken"
                type="password"
                required
                autoComplete="off"
                placeholder="EAAG…"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Vérification auprès de Meta…' : 'Enregistrer la connexion'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        )}

        {(state.error || state.success || flash.error || flash.success) && (
          <p
            className={`text-sm ${
              state.error || flash.error ? 'text-destructive' : 'text-emerald-400'
            }`}
          >
            {state.error || flash.error || state.success || flash.success}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          La connexion appartient à l’organisation, pas à un utilisateur. Owner / Manager / Staff
          utilisent le même WhatsApp selon leurs permissions.{' '}
          <Link href="/clients" className="text-primary underline">
            Retour clients
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
