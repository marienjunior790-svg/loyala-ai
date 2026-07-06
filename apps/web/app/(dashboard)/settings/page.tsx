import { requireAuth } from '@/lib/auth/guard';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SettingsPage() {
  const ctx = await requireAuth();

  return (
    <SectionPlaceholder
      title="Paramètres"
      description="Configuration de l'organisation, de l'équipe et des intégrations."
      badge="Actif"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Votre espace restaurant est actif.</p>
            <p className="text-xs">Rôle : {ctx.role.replace('org_', '')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Intégrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>WhatsApp — relances via lien direct (wa.me)</p>
            <p className="text-xs">Connexion WhatsApp Business API — bientôt disponible</p>
          </CardContent>
        </Card>
      </div>
    </SectionPlaceholder>
  );
}
