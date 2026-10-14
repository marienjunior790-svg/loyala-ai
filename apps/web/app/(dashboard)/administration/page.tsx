import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getOrganization, listOrganizationTeam } from '@loyala/domain-crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModuleError } from '@/components/dashboard/module-error';
import { resolveOrgRole } from '@/lib/auth/role-map';
import { planLabel, planStatusLabel, roleLabel } from '@/lib/labels';
import { getCountryOption } from '@/lib/countries';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['org_owner', 'org_admin']);

export default async function AdministrationPage() {
  const ctx = await requireAuth();

  if (!ADMIN_ROLES.has(ctx.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  try {
    const [org, members, user] = await Promise.all([
      getOrganization(supabase, ctx.organizationId),
      listOrganizationTeam(supabase, ctx.organizationId),
      getSession(),
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
                <span className="text-muted-foreground">Pays :</span>{' '}
                {getCountryOption(org?.country_code ?? '')?.label ?? org?.country_code}
              </p>
              <p>
                <span className="text-muted-foreground">Plan :</span> {planLabel(org?.plan)} (
                {planStatusLabel(org?.plan_status)})
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Équipe active</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((m) => {
                const isMe = m.user_id === ctx.userId;
                const email = m.email ?? (isMe ? user?.email : null);
                const name = m.full_name ?? email ?? 'Membre de l’équipe';
                const role = resolveOrgRole(m.role_code);
                return (
                  <div key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {name}
                        {isMe && <span className="ml-1.5 text-muted-foreground">(vous)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          m.full_name ? email : null,
                          m.joined_at
                            ? `Depuis le ${new Date(m.joined_at).toLocaleDateString('fr-FR')}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {role ? roleLabel(role) : 'Rôle non reconnu'}
                    </Badge>
                  </div>
                );
              })}
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
