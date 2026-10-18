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
  /** Contactable sur WhatsApp : accord donné ou à confirmer (tenu à jour en base). */
  opt_in_whatsapp: boolean;
  whatsapp_consent: 'accorde' | 'a_confirmer' | 'refuse';
  whatsapp_consent_at: string | null;
  whatsapp_consent_source: string | null;
  phone_e164: string | null;
  notes: string | null;
  acquisition_source: string | null;
  whatsapp_profile_name: string | null;
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

/** Comme `listClients`, sans la limite de 1 000 lignes de l'API : lit le fichier complet page par page. */
export async function listAllClients(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Client[]> {
  const pageSize = 1000;
  const clients: Client[] = [];
  for (let from = 0; from < 50 * pageSize; from += pageSize) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    clients.push(...((data ?? []) as Client[]));
    if (!data || data.length < pageSize) break;
  }
  return clients;
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

/** Un accord coché en caisse est donné ; importé ou déduit d'un message, il reste à confirmer. */
export function consentOnCreation(
  input: Pick<CreateClientInput, 'optInWhatsapp' | 'whatsappConsentSource'>
): Client['whatsapp_consent'] {
  if (!input.optInWhatsapp) return 'refuse';
  return input.whatsappConsentSource === 'formulaire' ? 'accorde' : 'a_confirmer';
}

export const WHATSAPP_CONSENT_LABELS: Record<Client['whatsapp_consent'], string> = {
  accorde: 'Accord donné',
  a_confirmer: 'Consentement à confirmer',
  refuse: 'Pas d’accord',
};

export type WhatsappConsentCounts = Record<Client['whatsapp_consent'], number>;

/** Répartition des clients actifs par état du consentement WhatsApp. */
export async function getWhatsappConsentCounts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<WhatsappConsentCounts> {
  const states = Object.keys(WHATSAPP_CONSENT_LABELS) as Client['whatsapp_consent'][];
  const results = await Promise.all(
    states.map((state) =>
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .eq('whatsapp_consent', state)
    )
  );
  const counts = {} as WhatsappConsentCounts;
  states.forEach((state, index) => {
    const res = results[index]!;
    if (res.error) throw new Error(res.error.message);
    counts[state] = res.count ?? 0;
  });
  return counts;
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
      date_of_birth: input.dateOfBirth || null,
      whatsapp_consent: consentOnCreation(input),
      whatsapp_consent_source: input.whatsappConsentSource,
      notes: input.notes || null,
      acquisition_source: input.acquisitionSource || null,
      whatsapp_profile_name: input.whatsappProfileName || null,
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
  if (input.dateOfBirth !== undefined) payload.date_of_birth = input.dateOfBirth || null;
  if (input.whatsappConsent !== undefined) {
    payload.whatsapp_consent = input.whatsappConsent;
    payload.whatsapp_consent_source = input.whatsappConsentSource ?? 'formulaire';
  }
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
