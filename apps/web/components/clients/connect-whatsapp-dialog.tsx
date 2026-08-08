'use client';

import { useState, useTransition } from 'react';
import { Check, MessageCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  convertWhatsAppLeadAction,
  ignoreWhatsAppLeadAction,
} from '@/app/(dashboard)/clients/_actions/acquisition';
import type { WhatsAppLead } from '@loyala/domain-crm';

interface ConnectWhatsAppDialogProps {
  open: boolean;
  onClose: () => void;
  whatsappPhone: string;
  phoneNumberId: string;
  apiConfigured: boolean;
  onSavePhoneNumberId?: (value: string) => void;
}

export function ConnectWhatsAppDialog({
  open,
  onClose,
  whatsappPhone,
  phoneNumberId,
  apiConfigured,
}: ConnectWhatsAppDialogProps) {
  if (!open) return null;

  const connected = Boolean(whatsappPhone.trim()) || apiConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-[min(100%,32rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Connectez votre WhatsApp Business</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralisez vos échanges WhatsApp dans Loyala et transformez progressivement vos
              conversations en clients CRM.
            </p>
          </div>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-secondary" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {[
            'Identifier les nouveaux clients',
            'Centraliser les contacts',
            'Faciliter les relances',
            'Éviter la saisie manuelle',
            'Suivre les interactions',
            'Préparer les automatisations futures',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl border border-border bg-background/50 p-4 text-sm">
          {connected ? (
            <>
              <p className="font-medium text-foreground">WhatsApp connecté ✓</p>
              <p className="mt-2 text-muted-foreground">
                Numéro : <span className="text-foreground">{whatsappPhone || 'Cloud API'}</span>
              </p>
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                Statut :{' '}
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Connecté
                </span>
              </p>
              {apiConfigured && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cloud API active (webhook Meta). Phone number id :{' '}
                  {phoneNumberId || 'défini côté worker'}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                La connexion Cloud API se configure dans{' '}
                <a href="/settings" className="text-primary underline">
                  Paramètres → WhatsApp Business
                </a>{' '}
                pour <strong>cette organisation uniquement</strong>. Aucun fallback vers un autre
                restaurant.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Pas encore configuré</p>
              <p className="mt-2 text-muted-foreground">
                1. Ajoutez votre numéro WhatsApp Business dans{' '}
                <a href="/settings" className="text-primary underline">
                  Paramètres
                </a>
                .
              </p>
              <p className="mt-1 text-muted-foreground">
                2. Pour l’API Cloud Meta : configurez les variables worker (`WHATSAPP_*`) et le
                webhook `https://…/whatsapp/webhook`.
              </p>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {whatsappPhone.trim() && (
            <Button type="button" variant="outline" asChild>
              <a
                href={`https://wa.me/${whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent('Test connexion Loyala AI')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tester la connexion
              </a>
            </Button>
          )}
          <Button type="button" variant="outline" asChild>
            <a href="/settings">Gérer WhatsApp</a>
          </Button>
          <Button type="button" variant="ghost" asChild>
            <a href="/settings">Déconnecter</a>
          </Button>
          <Button type="button" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppLeadsInbox({ leads }: { leads: WhatsAppLead[] }) {
  if (leads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Nouveaux contacts WhatsApp</h3>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

function LeadCard({ lead }: { lead: WhatsAppLead }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">🆕 Nouveau contact WhatsApp</p>
          <p className="mt-1 font-mono text-sm">+{lead.phone_normalized}</p>
          {lead.profile_name && (
            <p className="text-xs text-muted-foreground">{lead.profile_name}</p>
          )}
          {lead.last_message_preview && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              « {lead.last_message_preview} »
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Ce contact n’existe pas encore dans votre CRM.
            {lead.acquisition_source ? ` Source : ${lead.acquisition_source}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await convertWhatsAppLeadAction(lead.id);
                setMsg(res.error ?? res.success ?? null);
                if (res.success) setGone(true);
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Ajouter au CRM
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await ignoreWhatsAppLeadAction(lead.id);
                if (res.success) setGone(true);
                else setMsg(res.error ?? null);
              })
            }
          >
            Ignorer
          </Button>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
