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

const ORG_SELECT_FULL =
  'id, name, slug, country_code, timezone, currency, plan, plan_status, settings';
const ORG_SELECT_CORE = 'id, name, slug, settings';

function isMissingSchemaColumn(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  );
}

function normalizeOrganization(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    country_code: String(row.country_code ?? 'SN'),
    timezone: String(row.timezone ?? 'Africa/Dakar'),
    currency: String(row.currency ?? 'XOF'),
    plan: String(row.plan ?? 'starter'),
    plan_status: String(row.plan_status ?? 'trialing'),
    settings: (row.settings as Record<string, unknown>) ?? {},
  };
}

/**
 * Load org with progressive fallbacks when production schema lags (missing
 * plan_status / deleted_at / etc.). Prefer applying migration 020 / hotfix SQL.
 */
export async function getOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Organization | null> {
  const attempts = [
    () =>
      supabase
        .from('organizations')
        .select(ORG_SELECT_FULL)
        .eq('id', organizationId)
        .is('deleted_at', null)
        .maybeSingle(),
    () =>
      supabase
        .from('organizations')
        .select(ORG_SELECT_FULL)
        .eq('id', organizationId)
        .maybeSingle(),
    () =>
      supabase
        .from('organizations')
        .select(ORG_SELECT_CORE)
        .eq('id', organizationId)
        .maybeSingle(),
  ] as const;

  let lastError: string | null = null;
  for (const run of attempts) {
    const { data, error } = await run();
    if (!error) {
      return data ? normalizeOrganization(data as Record<string, unknown>) : null;
    }
    lastError = error.message;
    if (!isMissingSchemaColumn(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error(
    lastError ??
      'Organisation inaccessible — appliquez le hotfix organizations (plan_status)'
  );
}

export async function updateOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  patch: {
    name?: string;
    countryCode?: string;
    timezone?: string;
    currency?: string;
    settings?: Record<string, unknown>;
  }
): Promise<Organization> {
  const fullPayload: Record<string, unknown> = {};
  if (patch.name) fullPayload.name = patch.name;
  if (patch.countryCode) fullPayload.country_code = patch.countryCode;
  if (patch.timezone) fullPayload.timezone = patch.timezone;
  if (patch.currency) fullPayload.currency = patch.currency;
  if (patch.settings) fullPayload.settings = patch.settings;

  const corePayload: Record<string, unknown> = {};
  if (patch.name) corePayload.name = patch.name;
  if (patch.settings) corePayload.settings = patch.settings;

  const tries: Array<{ payload: Record<string, unknown>; select: string }> = [
    { payload: fullPayload, select: ORG_SELECT_FULL },
    { payload: fullPayload, select: ORG_SELECT_CORE },
    { payload: corePayload, select: ORG_SELECT_CORE },
  ];

  let lastError: string | null = null;
  for (const { payload, select } of tries) {
    if (Object.keys(payload).length === 0) continue;
    const { data, error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', organizationId)
      .select(select)
      .single();

    if (!error && data) {
      return normalizeOrganization(data as Record<string, unknown>);
    }
    lastError = error?.message ?? 'update failed';
    if (error && !isMissingSchemaColumn(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error(
    lastError ??
      'Échec sauvegarde — appliquez scripts/sql/hotfix-organizations-plan-status.sql'
  );
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
