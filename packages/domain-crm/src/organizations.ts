import type { SupabaseClient } from '@supabase/supabase-js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  timezone: string;
  currency: string;
  plan: string;
  plan_status: string;
  settings: Record<string, unknown>;
}

export async function getOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, country_code, timezone, currency, plan, plan_status, settings')
    .eq('id', organizationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Organization | null;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  patch: {
    name?: string;
    settings?: Record<string, unknown>;
  }
): Promise<Organization> {
  const payload: Record<string, unknown> = {};
  if (patch.name) payload.name = patch.name;
  if (patch.settings) payload.settings = patch.settings;

  const { data, error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', organizationId)
    .select('id, name, slug, country_code, timezone, currency, plan, plan_status, settings')
    .single();

  if (error) throw new Error(error.message);
  return data as Organization;
}

export interface OrgMember {
  user_id: string;
  role_code: string | null;
  status: string;
  joined_at: string | null;
}

export async function listOrganizationMembers(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, status, joined_at, roles(code)')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const roles = row.roles as { code: string } | { code: string }[] | null;
    const roleCode = Array.isArray(roles) ? roles[0]?.code : roles?.code;
    return {
      user_id: String(row.user_id),
      role_code: roleCode ?? null,
      status: String(row.status),
      joined_at: row.joined_at ? String(row.joined_at) : null,
    };
  });
}
