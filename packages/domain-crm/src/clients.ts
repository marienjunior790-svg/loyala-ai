import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateClientInput, UpdateClientInput } from '@loyala/validation';

export interface Client {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  segment: string;
  visit_count: number;
  total_spent: number;
  loyalty_points: number;
  last_visit_at: string | null;
  date_of_birth: string | null;
  opt_in_whatsapp: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listClients(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export async function getClient(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single();

  if (error) return null;
  return data as Client;
}

export async function createClient(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateClientInput
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: organizationId,
      full_name: input.fullName,
      phone: input.phone.replace(/\s/g, ''),
      email: input.email || null,
      opt_in_whatsapp: input.optInWhatsapp,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Client;
}

export async function updateClient(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  input: UpdateClientInput
): Promise<Client> {
  const payload: Record<string, unknown> = {};
  if (input.fullName) payload.full_name = input.fullName;
  if (input.phone) payload.phone = input.phone.replace(/\s/g, '');
  if (input.email !== undefined) payload.email = input.email || null;
  if (input.optInWhatsapp !== undefined) payload.opt_in_whatsapp = input.optInWhatsapp;
  if (input.notes !== undefined) payload.notes = input.notes || null;

  const { data, error } = await supabase
    .from('clients')
    .update(payload)
    .eq('id', clientId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Client;
}

export async function softDeleteClient(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
}
