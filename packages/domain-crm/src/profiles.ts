import type { SupabaseClient } from '@supabase/supabase-js';
import { listOrganizationMembers } from './organizations';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role_code: string | null;
  status: string;
  joined_at: string | null;
}

function isMissingProfilesSchema(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find');
}

/** Returns null when migration 038 (profiles) is not applied yet. */
export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingProfilesSchema(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    id: String(data.id),
    full_name: data.full_name ? String(data.full_name) : null,
    email: data.email ? String(data.email) : null,
    avatar_url: data.avatar_url ? String(data.avatar_url) : null,
  };
}

export async function updateMyProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  patch: { fullName: string }
): Promise<void> {
  const fullName = patch.fullName.trim() || null;
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: fullName, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) {
    if (isMissingProfilesSchema(error.message)) {
      throw new Error('Profils indisponibles — appliquez la migration 038_profiles.sql');
    }
    throw new Error(error.message);
  }
}

/** Team with display names; falls back to raw memberships before migration 038. */
export async function listOrganizationTeam(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('list_organization_team', {
    p_organization_id: organizationId,
  });

  if (!error) {
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      user_id: String(row.user_id),
      full_name: row.full_name ? String(row.full_name) : null,
      email: row.email ? String(row.email) : null,
      role_code: row.role_code ? String(row.role_code) : null,
      status: String(row.status ?? 'active'),
      joined_at: row.joined_at ? String(row.joined_at) : null,
    }));
  }

  if (!/list_organization_team|schema cache|could not find|does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }

  const members = await listOrganizationMembers(supabase, organizationId);
  return members.map((m) => ({ ...m, full_name: null, email: null }));
}
