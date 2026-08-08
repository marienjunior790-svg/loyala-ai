import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAddressForChannel } from './conversation-sessions';

export const DEFAULT_ACQUISITION_SOURCES: { slug: string; label: string; messageTemplate: string }[] = [
  {
    slug: 'qr_caisse',
    label: 'QR caisse',
    messageTemplate:
      'Bonjour, je souhaite rejoindre le programme fidélité de {{restaurant}} (caisse).',
  },
  {
    slug: 'qr_table',
    label: 'QR table',
    messageTemplate:
      'Bonjour, je suis à table et je souhaite rejoindre le programme fidélité de {{restaurant}}.',
  },
  {
    slug: 'menu',
    label: 'Menu',
    messageTemplate: 'Bonjour, je découvre le menu de {{restaurant}} et je souhaite rester en contact.',
  },
  {
    slug: 'instagram',
    label: 'Instagram',
    messageTemplate: 'Bonjour, je viens d’Instagram et je souhaite rejoindre {{restaurant}}.',
  },
  {
    slug: 'facebook',
    label: 'Facebook',
    messageTemplate: 'Bonjour, je viens de Facebook et je souhaite rejoindre {{restaurant}}.',
  },
  {
    slug: 'website',
    label: 'Site web',
    messageTemplate: 'Bonjour, je viens du site web et je souhaite rejoindre {{restaurant}}.',
  },
  {
    slug: 'flyer',
    label: 'Flyer',
    messageTemplate: 'Bonjour, j’ai vu votre flyer et je souhaite rejoindre {{restaurant}}.',
  },
  {
    slug: 'other',
    label: 'Autre',
    messageTemplate: 'Bonjour, je souhaite rejoindre le programme fidélité de {{restaurant}}.',
  },
];

export interface AcquisitionSource {
  id: string;
  organization_id: string;
  slug: string;
  label: string;
  channel: string;
  message_template: string | null;
  created_at: string;
}

export interface WhatsAppLead {
  id: string;
  organization_id: string;
  phone: string;
  phone_normalized: string;
  profile_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_wamid: string | null;
  acquisition_source: string | null;
  status: 'pending' | 'converted' | 'ignored';
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Parse optional source tag from inbound WhatsApp text, e.g. `[ref:instagram]`. */
export function parseAcquisitionSourceFromMessage(body?: string | null): string | null {
  if (!body) return null;
  const match = body.match(/\[?\s*ref\s*:\s*([a-z0-9_-]+)\s*\]?/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function renderAcquisitionMessage(
  template: string,
  restaurantName: string
): string {
  return template.replace(/\{\{\s*restaurant\s*\}\}/gi, restaurantName);
}

export async function ensureDefaultAcquisitionSources(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AcquisitionSource[]> {
  const existing = await listAcquisitionSources(supabase, organizationId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_ACQUISITION_SOURCES.map((s) => ({
    organization_id: organizationId,
    slug: s.slug,
    label: s.label,
    channel: 'whatsapp',
    message_template: s.messageTemplate,
  }));

  const { error } = await supabase.from('acquisition_sources').insert(rows);
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }

  return listAcquisitionSources(supabase, organizationId);
}

export async function listAcquisitionSources(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AcquisitionSource[]> {
  const { data, error } = await supabase
    .from('acquisition_sources')
    .select('*')
    .eq('organization_id', organizationId)
    .order('label', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AcquisitionSource[];
}

export async function listPendingWhatsAppLeads(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50
): Promise<WhatsAppLead[]> {
  const { data, error } = await supabase
    .from('whatsapp_leads')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as WhatsAppLead[];
}

export async function countPendingWhatsAppLeads(
  supabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('whatsapp_leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function upsertWhatsAppLead(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    phone: string;
    profileName?: string | null;
    preview?: string | null;
    wamid?: string | null;
    inboundAt?: string;
    acquisitionSource?: string | null;
  }
): Promise<WhatsAppLead | null> {
  const phoneNormalized = normalizeAddressForChannel('whatsapp', input.phone);
  if (!phoneNormalized) throw new Error('Numéro WhatsApp invalide');

  const now = input.inboundAt ?? new Date().toISOString();

  const { data: existing } = await supabase
    .from('whatsapp_leads')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('phone_normalized', phoneNormalized)
    .maybeSingle();

  // Already a CRM client — do not reopen as lead
  if (existing?.status === 'converted') {
    await supabase
      .from('whatsapp_leads')
      .update({
        last_message_preview: input.preview?.slice(0, 280) || existing.last_message_preview,
        last_message_at: now,
        last_wamid: input.wamid || existing.last_wamid,
        profile_name: input.profileName?.trim() || existing.profile_name,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('organization_id', input.organizationId);
    return null;
  }

  // Ignored contacts that write again re-enter the inbox
  const nextStatus = 'pending' as const;
  const row = {
    organization_id: input.organizationId,
    phone: input.phone.replace(/\s/g, ''),
    phone_normalized: phoneNormalized,
    profile_name: input.profileName?.trim() || existing?.profile_name || null,
    last_message_preview: input.preview?.slice(0, 280) || null,
    last_message_at: now,
    last_wamid: input.wamid || null,
    acquisition_source:
      input.acquisitionSource || existing?.acquisition_source || null,
    status: nextStatus,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('whatsapp_leads')
    .upsert(row, { onConflict: 'organization_id,phone_normalized' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WhatsAppLead;
}

export async function ignoreWhatsAppLead(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_leads')
    .update({ status: 'ignored', updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export async function markWhatsAppLeadConverted(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
  clientId: string
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_leads')
    .update({
      status: 'converted',
      client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
}

export interface AcquisitionStats {
  newThisWeek: number;
  newThisMonth: number;
  whatsappClients: number;
  toRelaunch: number;
  pendingLeads: number;
  primarySource: string | null;
  bySource: { source: string; count: number }[];
}

export async function getAcquisitionStats(
  supabase: SupabaseClient,
  organizationId: string,
  opts?: { inactiveClientIds?: string[] }
): Promise<AcquisitionStats> {
  const clients = await supabase
    .from('clients')
    .select('id, acquisition_source, opt_in_whatsapp, created_at, last_visit_at, visit_count, total_spent, segment')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (clients.error) throw new Error(clients.error.message);

  const rows = clients.data ?? [];
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;

  let newThisWeek = 0;
  let newThisMonth = 0;
  let whatsappClients = 0;
  const sourceCounts = new Map<string, number>();

  for (const c of rows) {
    const created = new Date(String(c.created_at)).getTime();
    if (created >= weekAgo) newThisWeek += 1;
    if (created >= monthAgo) newThisMonth += 1;
    if (c.opt_in_whatsapp !== false) whatsappClients += 1;
    const src = (c.acquisition_source as string | null)?.trim();
    if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }

  const bySource = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const pendingLeads = await countPendingWhatsAppLeads(supabase, organizationId);

  return {
    newThisWeek,
    newThisMonth,
    whatsappClients,
    toRelaunch: opts?.inactiveClientIds?.length ?? 0,
    pendingLeads,
    primarySource: bySource[0]?.source ?? null,
    bySource,
  };
}

/**
 * Resolve organization(s) that own a Meta phone_number_id.
 * Prefer explicit settings.whatsapp_phone_number_id; single-tenant fallback
 * when env WHATSAPP_PHONE_NUMBER_ID matches and exactly one org has whatsapp_phone.
 */
export async function resolveOrganizationsForWhatsAppPhoneNumberId(
  supabase: SupabaseClient,
  phoneNumberId: string | undefined
): Promise<string[]> {
  if (!phoneNumberId) return [];

  const { data, error } = await supabase.from('organizations').select('id, settings');
  if (error) throw new Error(error.message);

  const matched = (data ?? [])
    .filter((row) => {
      const settings = (row.settings as Record<string, unknown>) ?? {};
      return String(settings.whatsapp_phone_number_id ?? '') === phoneNumberId;
    })
    .map((row) => String(row.id));

  if (matched.length > 0) return matched;

  const envId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!envId || envId !== phoneNumberId) return [];

  const withPhone = (data ?? [])
    .filter((row) => {
      const settings = (row.settings as Record<string, unknown>) ?? {};
      return Boolean(String(settings.whatsapp_phone ?? '').trim());
    })
    .map((row) => String(row.id));

  return withPhone.length === 1 ? withPhone : [];
}
