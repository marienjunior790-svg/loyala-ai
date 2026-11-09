'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
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
import {
  beginWhatsAppEmbeddedSignupAction,
  completeWhatsAppEmbeddedSignupAction,
} from '@/app/(dashboard)/settings/_actions/whatsapp-embedded-signup';
import type { WhatsAppConnectionPublic } from '@loyala/domain-crm';
import { whatsAppStatusCopy, type GuidedWhatsAppSignup } from '@/lib/whatsapp/guided-signup';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup-launch';
import {
  embeddedSignupFlowCopy,
  mapLaunchFailureToPhase,
  resolveInitialEmbeddedSignupPhase,
  type EmbeddedSignupFlowPhase,
} from '@/lib/whatsapp/embedded-signup-flow';

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
  const [esPhase, setEsPhase] = useState<EmbeddedSignupFlowPhase>(() =>
    resolveInitialEmbeddedSignupPhase({
      canLaunch: guidedSignup.canLaunch,
      connectionReady: initialConnection.isReady,
    })
  );
  const [esDetail, setEsDetail] = useState<string | null>(null);
  const launchLock = useRef(false);

  const ready = connection.isReady;
  const statusCopy = whatsAppStatusCopy(connection);
  const flowCopy = embeddedSignupFlowCopy(esPhase);
  const esBusy =
    esPhase === 'launching_meta' ||
    esPhase === 'meta_authenticating' ||
    esPhase === 'server_processing' ||
    esPhase === 'verifying';

  const runEmbeddedSignup = () => {
    if (launchLock.current || esBusy) return;
    if (connection.isReady) {
      setEsPhase('already_connected');
      return;
    }
    if (!guidedSignup.canLaunch) {
      setEsPhase('unconfigured');
      return;
    }

    launchLock.current = true;
    setEsDetail(null);
    setFlash({});
    setEsPhase('launching_meta');

    start(async () => {
      try {
        const begin = await beginWhatsAppEmbeddedSignupAction();
        if (begin.alreadyConnected && begin.connection) {
          setConnection(begin.connection);
          setEsPhase('already_connected');
          setFlash({ success: begin.success });
          return;
        }
        if (begin.error || !begin.launch) {
          setEsPhase('failed');
          setEsDetail(begin.error ?? 'Impossible de démarrer la connexion guidée.');
          return;
        }

        setEsPhase('meta_authenticating');
        const launched = await launchWhatsAppEmbeddedSignup({
          appId: begin.launch.appId,
          configId: begin.launch.configId,
          apiVersion: begin.launch.apiVersion,
        });

        if (!launched.ok) {
          const phase = mapLaunchFailureToPhase(launched.reason);
          setEsPhase(phase);
          setEsDetail(launched.message);
          return;
        }

        setEsPhase('server_processing');
        const completed = await completeWhatsAppEmbeddedSignupAction({
          state: begin.launch.state,
          code: launched.code,
          phoneNumberId: launched.assets.phoneNumberId,
          wabaId: launched.assets.wabaId,
          displayPhone: launched.assets.displayPhone,
        });

        if (completed.connection) setConnection(completed.connection);

        if (completed.error || !completed.connected) {
          setEsPhase('failed');
          setEsDetail(
            completed.error ??
              'La connexion n’a pas pu être confirmée. Réessayez.'
          );
          return;
        }

        setEsPhase('verifying');
        setEsPhase('connected');
        setFlash({ success: completed.success ?? 'WhatsApp est connecté ✓' });
        setShowForm(false);
      } catch {
        setEsPhase('failed');
        setEsDetail('Impossible de finaliser la connexion. Réessayez.');
      } finally {
        launchLock.current = false;
      }
    });
  };

  const progressTitle = esBusy || esPhase === 'cancelled' || esPhase === 'failed'
    ? (esDetail && (esPhase === 'failed' || esPhase === 'cancelled')
        ? flowCopy.title
        : flowCopy.title)
    : null;

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
            {connection.lastError && !esBusy && (
              <p className="text-xs text-destructive">{connection.lastError}</p>
            )}

            {(esBusy || esPhase === 'cancelled' || esPhase === 'failed' || esPhase === 'unconfigured') && (
              <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                {esBusy ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
                <div>
                  <p className="font-medium">{progressTitle ?? flowCopy.title}</p>
                  <p className="text-muted-foreground">{esDetail ?? flowCopy.detail}</p>
                </div>
              </div>
            )}

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={esBusy}
                  onClick={runEmbeddedSignup}
                >
                  {esBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {esPhase === 'failed' || esPhase === 'cancelled'
                    ? 'Réessayer'
                    : 'Connecter mon WhatsApp'}
                </Button>
                {!esBusy && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowForm((v) => !v)}
                  >
                    {showForm ? 'Masquer la configuration avancée' : 'Configuration avancée (admin)'}
                  </Button>
                )}
              </div>
            )}

            {!guidedSignup.canLaunch && canManage && !esBusy && esPhase !== 'failed' && (
              <p className="text-xs text-muted-foreground">{guidedSignup.message}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-emerald-400">
              {esPhase === 'connected' || esPhase === 'already_connected'
                ? flowCopy.title
                : statusCopy.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {statusCopy.message}
            </p>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowForm((v) => !v)}
                >
                  Configuration avancée (admin)
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
                      setEsPhase(
                        resolveInitialEmbeddedSignupPhase({
                          canLaunch: guidedSignup.canLaunch,
                          connectionReady: false,
                        })
                      );
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
            <p className="text-sm font-medium">Configuration avancée (admin)</p>
            <p className="text-xs text-muted-foreground">
              Secours technique uniquement. Le parcours restaurant normal n’utilise jamais ces champs :
              Meta Embedded Signup fournit automatiquement le numéro et le compte.
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

        {(state.error || state.success || flash.error || flash.success) && !esBusy && (
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
