import Link from 'next/link';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/session';

export default async function SettingsPage() {
  const ctx = await getAuthContext();

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
            <p>ID : {ctx?.organizationId ?? '—'}</p>
            <p>Rôle : {ctx?.role ?? '—'}</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/onboarding">Reconfigurer</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Intégrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>WhatsApp Business — non connecté</p>
            <p>Google Business — non connecté</p>
            <Button variant="secondary" size="sm" disabled>
              Connecter (Sprint 2)
            </Button>
          </CardContent>
        </Card>
      </div>
    </SectionPlaceholder>
  );
}
