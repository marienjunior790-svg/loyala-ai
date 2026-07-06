import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrganization, listOrganizationMembers } from '@loyala/domain-crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['org_owner', 'org_admin']);

export default async function AdministrationPage() {
  const ctx = await requireAuth();

  if (!ADMIN_ROLES.has(ctx.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  try {
    const [org, members] = await Promise.all([
      getOrganization(supabase, ctx.organizationId),
      listOrganizationMembers(supabase, ctx.organizationId),
    ]);

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Administration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organisation, équipe et statut plateforme
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Nom :</span> {org?.name}
              </p>
              <p>
                <span className="text-muted-foreground">Slug :</span>{' '}
                <code className="text-xs">{org?.slug}</code>
              </p>
              <p>
                <span className="text-muted-foreground">Pays :</span> {org?.country_code}
              </p>
              <p>
                <span className="text-muted-foreground">Plan :</span> {org?.plan} ({org?.plan_status})
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Équipe active</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between text-sm">
                  <code className="text-xs">{m.user_id.slice(0, 8)}…</code>
                  <Badge variant="secondary">{m.role_code?.replace('org_', '') ?? '—'}</Badge>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun membre visible</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (e) {
    return <ModuleError message={e instanceof Error ? e.message : 'Erreur administration'} />;
  }
}
