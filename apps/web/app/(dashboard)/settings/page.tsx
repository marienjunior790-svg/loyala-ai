import { requireAuth } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import { getOrganization, getWhatsAppConnectionPublic } from '@loyala/domain-crm';
import { SettingsForm } from '@/components/settings/settings-form';
import { WhatsAppBusinessSettings } from '@/components/settings/whatsapp-business-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const canManageWhatsApp =
    hasPermission(ctx, 'org:settings') || ctx.role === 'org_owner' || ctx.role === 'org_admin';
  const showAdminIds = canManageWhatsApp;

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    if (!org) return <ModuleError message="Organisation introuvable" />;

    const connection = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuration de votre restaurant
          </p>
        </div>

        <SettingsForm org={org} />

        <WhatsAppBusinessSettings
          connection={connection}
          canManage={canManageWhatsApp}
          showAdminIds={showAdminIds}
        />

        <Card>
          <CardHeader>
            <CardTitle>Intégrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              WhatsApp Business — connexion par organisation (Cloud API Meta), voir section
              ci-dessus
            </p>
            <p>Avis Google — demande WhatsApp auto après visite (lien Paramètres)</p>
            <p>Worker IA — {process.env.WORKER_URL ? 'connecté' : 'non configuré'}</p>
            <p>Inngest — campagnes automatiques quotidiennes (08h UTC)</p>
            <p>Email — {process.env.RESEND_API_KEY ? 'Resend actif' : 'configurez RESEND_API_KEY'}</p>
            <p>Paiement — upgrade via page Paiement ou WhatsApp</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">Rôle actuel : {ctx.role}</p>
      </div>
    );
  } catch (e) {
    return <ModuleError message={e instanceof Error ? e.message : 'Erreur paramètres'} />;
  }
}
