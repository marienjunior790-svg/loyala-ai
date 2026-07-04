import { createClient } from '../supabase/server';
import { createAdminClient } from '@loyala/db';
import { ORG_COOKIE_NAME, type AuthContext, type OrgRole } from '@loyala/core-iam';
import { cookies } from 'next/headers';
import { getSupabaseEnv, getServiceRoleKey } from '../supabase/env';
import { getActiveMembership } from './membership';
import { resolveOrgRole } from './role-map';

export async function getSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getSession();
  if (!user) return null;

  const cookieStore = await cookies();
  let organizationId = cookieStore.get(ORG_COOKIE_NAME)?.value;

  const supabase = await createClient();

  if (!organizationId) {
    const active = await getActiveMembership(supabase);
    if (!active) return null;
    organizationId = active.organization_id;
  }

  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id, role_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member) return null;

  let role: OrgRole = 'org_viewer';

  if (member.role_id) {
    const { data: roleRow } = await supabase
      .from('roles')
      .select('code')
      .eq('id', member.role_id)
      .maybeSingle();

    role = resolveOrgRole(roleRow?.code);
  }

  return {
    userId: user.id,
    organizationId: member.organization_id,
    role,
  };
}

/** Admin client — onboarding & tests only */
export function getAdminClient() {
  const { url } = getSupabaseEnv();
  return createAdminClient(url, getServiceRoleKey());
}
