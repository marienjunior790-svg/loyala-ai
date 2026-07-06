import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@loyala/domain-crm';
import { SettingsForm } from '@/components/settings/settings-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    if (!org) return <ModuleError message="Organisation introuvable" />;

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuration de votre restaurant
          </p>
        </div>

        <SettingsForm org={org} />

        <Card>
          <CardHeader>
            <CardTitle>Intégrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>WhatsApp — relances via lien direct (wa.me)</p>
            <p>Worker IA — {process.env.WORKER_URL ? 'configuré' : 'non configuré'}</p>
            <p>Stripe — activation sur demande (page Paiement)</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">Rôle actuel : {ctx.role}</p>
      </div>
    );
  } catch (e) {
    return <ModuleError message={e instanceof Error ? e.message : 'Erreur paramètres'} />;
  }
}
