'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientsAcquisitionPanel } from '@/components/clients/clients-acquisition-panel';
import {
  ConnectWhatsAppDialog,
  WhatsAppLeadsInbox,
} from '@/components/clients/connect-whatsapp-dialog';
import type { AcquisitionStats, WhatsAppLead } from '@loyala/domain-crm';

interface ClientsAcquisitionShellProps {
  canWrite: boolean;
  stats: AcquisitionStats;
  leads: WhatsAppLead[];
  whatsappPhone: string;
  phoneNumberId: string;
  apiConfigured: boolean;
}

export function ClientsAcquisitionShell({
  canWrite,
  stats,
  leads,
  whatsappPhone,
  phoneNumberId,
  apiConfigured,
}: ClientsAcquisitionShellProps) {
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Relancez vos clients inactifs en 1 clic via WhatsApp
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="shrink-0" onClick={() => setConnectOpen(true)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Connecter WhatsApp
          </Button>
          {canWrite ? (
            <Button asChild className="shrink-0">
              <Link href="/clients/ajouter">
                <Plus className="h-4 w-4" />
                Ajouter un client
              </Link>
            </Button>
          ) : (
            <Button className="shrink-0" disabled>
              <Plus className="h-4 w-4" />
              Ajouter un client
            </Button>
          )}
        </div>
      </div>

      <ClientsAcquisitionPanel
        stats={stats}
        canWrite={canWrite}
        onConnectWhatsApp={() => setConnectOpen(true)}
      />

      <WhatsAppLeadsInbox leads={leads} />

      <ConnectWhatsAppDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        whatsappPhone={whatsappPhone}
        phoneNumberId={phoneNumberId}
        apiConfigured={apiConfigured}
      />
    </>
  );
}
