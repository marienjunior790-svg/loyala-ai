import { createClient } from '../supabase/server';
import { createAdminClient } from '@loyala/db';
import { ORG_COOKIE_NAME, type AuthContext, type OrgRole } from '@loyala/core-iam';
import { cookies } from 'next/headers';
import { getSupabaseEnv, getServiceRoleKey } from '../supabase/env';
import { getActiveMembership } from './membership';

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

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id, roles(code)')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .single();

  if (!member) return null;

  const rolesData = member.roles as { code: string } | { code: string }[] | null;
  const roleCode = Array.isArray(rolesData) ? rolesData[0]?.code : rolesData?.code;
  const resolvedOrgId = member.organization_id;

  return {
    userId: user.id,
    organizationId: resolvedOrgId,
    role: (roleCode ?? 'org_viewer') as OrgRole,
  };
}

/** Admin client — onboarding & tests only */
export function getAdminClient() {
  const { url } = getSupabaseEnv();
  return createAdminClient(url, getServiceRoleKey());
}
