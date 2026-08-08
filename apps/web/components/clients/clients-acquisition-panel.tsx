'use client';

import Link from 'next/link';
import { Megaphone, Users, UserPlus, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AcquisitionStats } from '@loyala/domain-crm';

interface ClientsAcquisitionPanelProps {
  stats: AcquisitionStats;
  canWrite: boolean;
  onConnectWhatsApp: () => void;
}

export function ClientsAcquisitionPanel({
  stats,
  canWrite,
  onConnectWhatsApp,
}: ClientsAcquisitionPanelProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Votre acquisition clients
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              Transformez vos conversations WhatsApp en clients Loyala
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onConnectWhatsApp}>
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              Connecter WhatsApp
            </Button>
            {canWrite && (
              <Button type="button" size="sm" asChild>
                <Link href="/clients/collecter">
                  <Megaphone className="h-4 w-4" />
                  Collecter des clients
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Nouveaux clients" value={String(stats.newThisWeek)} hint="7 derniers jours" />
          <Stat label="Cette semaine" value={String(stats.newThisWeek)} hint="créations CRM" />
          <Stat
            label="Clients WhatsApp"
            value={String(stats.whatsappClients)}
            hint="opt-in actif"
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <Stat
            label="À relancer"
            value={String(stats.toRelaunch)}
            hint={
              stats.pendingLeads > 0
                ? `${stats.pendingLeads} contact(s) WhatsApp en attente`
                : 'inactifs'
            }
            icon={<UserPlus className="h-3.5 w-3.5" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
