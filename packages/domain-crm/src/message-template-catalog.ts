import type { SupabaseClient } from '@supabase/supabase-js';

export type TemplateCatalogStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type TemplateCatalogIntent =
  | 'birthday'
  | 'inactive'
  | 'loyalty'
  | 'promo'
  | 'transactional'
  | 'reply';

export interface TemplateVariableSpecRow {
  slot: number;
  maxLength: number;
  role: 'first_name' | 'body_core' | 'restaurant_name' | 'offer' | 'custom';
}

export interface MessageTemplateCatalogRow {
  id: string;
  organization_id: string | null;
  channel: string;
  intent: TemplateCatalogIntent;
  provider_template_name: string;
  language: string;
  body_pattern: string;
  variable_count: number;
  variable_specs: TemplateVariableSpecRow[];
  category: 'marketing' | 'utility';
  status: TemplateCatalogStatus;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listApprovedWhatsAppTemplateRows(
  supabase: SupabaseClient,
  organizationId?: string
): Promise<MessageTemplateCatalogRow[]> {
  let query = supabase
    .from('message_template_catalog')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('status', 'approved');

  if (organizationId) {
    query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.order('intent', { ascending: true });
  assertOk(error);
  return (data as MessageTemplateCatalogRow[]) ?? [];
}

export async function listMessageTemplateCatalog(
  supabase: SupabaseClient,
  filters?: { status?: TemplateCatalogStatus }
): Promise<MessageTemplateCatalogRow[]> {
  let query = supabase.from('message_template_catalog').select('*').order('intent');
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  const { data, error } = await query;
  assertOk(error);
  return (data as MessageTemplateCatalogRow[]) ?? [];
}

export async function markTemplatesApprovedByName(
  supabase: SupabaseClient,
  providerTemplateNames: string[]
): Promise<number> {
  if (providerTemplateNames.length === 0) return 0;

  const { data, error } = await supabase
    .from('message_template_catalog')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .in('provider_template_name', providerTemplateNames)
    .eq('channel', 'whatsapp')
    .select('id');

  assertOk(error);
  return data?.length ?? 0;
}
