import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listCampaignSends } from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function RelancesPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let sends: Awaited<ReturnType<typeof listCampaignSends>> = [];
  let error: string | null = null;

  try {
    sends = await listCampaignSends(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Relances WhatsApp</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique des messages et liens d&apos;envoi
        </p>
      </div>

      {error && <ModuleError message={error} />}

      {sends.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucune relance enregistrée.</p>
            <Button className="mt-4" asChild>
              <Link href="/clients">Relancer depuis Clients</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sends.map((s) => {
            const client = s.clients as { full_name: string; phone: string } | null;
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{client?.full_name ?? 'Client'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.message_body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === 'sent' ? 'success' : 'warning'}>{s.status}</Badge>
                    {s.whatsapp_url && (
                      <Button size="sm" asChild>
                        <a href={s.whatsapp_url} target="_blank" rel="noopener noreferrer">
                          Envoyer
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
