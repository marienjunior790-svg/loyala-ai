'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  createClient as createCrmClient,
  ignoreWhatsAppLead,
  listPendingWhatsAppLeads,
  markWhatsAppLeadConverted,
  getOrganization,
} from '@loyala/domain-crm';
import { normalizeInternationalPhone, normalizePhoneE164 } from '@loyala/integrations/phone';
import { createClientSchema } from '@loyala/validation';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Client existant du restaurant pour ce numéro (comparaison au format international). */
async function findClientIdByPhone(
  supabase: ServerSupabase,
  organizationId: string,
  e164: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('phone_e164', e164)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

export type LeadActionState = { error?: string; success?: string };

export async function convertWhatsAppLeadAction(
  leadId: string
): Promise<LeadActionState> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const supabase = await createClient();
    const leads = await listPendingWhatsAppLeads(supabase, ctx.organizationId, 200);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return { error: 'Contact introuvable ou déjà traité' };

    const e164 = normalizeInternationalPhone(lead.phone_normalized) ?? normalizeInternationalPhone(lead.phone);
    if (!e164) return { error: 'Numéro WhatsApp du contact non reconnu' };
    const existingId = await findClientIdByPhone(supabase, ctx.organizationId, e164);

    if (existingId) {
      await markWhatsAppLeadConverted(supabase, ctx.organizationId, leadId, existingId);
      revalidatePath('/clients');
      revalidatePath('/clients/collecter');
      return { success: 'Contact déjà client — associé sans doublon' };
    }

    const fullName =
      lead.profile_name?.trim() ||
      lead.phone_normalized;

    const parsed = createClientSchema.safeParse({
      fullName,
      phone: e164,
      optInWhatsapp: true,
      whatsappConsentSource: 'message_entrant',
      acquisitionSource: lead.acquisition_source || 'whatsapp_inbound',
      whatsappProfileName: lead.profile_name || '',
      notes: 'Créé depuis un message WhatsApp entrant',
    });
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
    }

    const client = await createCrmClient(supabase, ctx.organizationId, parsed.data);
    await markWhatsAppLeadConverted(supabase, ctx.organizationId, leadId, client.id);
    revalidatePath('/clients');
    revalidatePath('/clients/collecter');
    return { success: 'Client ajouté au CRM' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur conversion' };
  }
}

export async function ignoreWhatsAppLeadAction(leadId: string): Promise<LeadActionState> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const supabase = await createClient();
    await ignoreWhatsAppLead(supabase, ctx.organizationId, leadId);
    revalidatePath('/clients');
    revalidatePath('/clients/collecter');
    return { success: 'Contact ignoré' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}

export type CsvImportState = {
  error?: string;
  success?: string;
  created?: number;
  skipped?: number;
  errors?: string[];
};

/** Sans colonne de consentement, un contact importé n'est pas contactable. */
function csvOptIn(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return !['', '0', 'false', 'non', 'no'].includes(raw.trim().toLowerCase());
}

/** Simple CSV import: expects headers name/full_name/nom + phone/telephone/whatsapp */
export async function importClientsCsvAction(formData: FormData): Promise<CsvImportState> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { error: 'Fichier CSV requis' };
    }
    if (file.size > 2_000_000) return { error: 'Fichier trop volumineux (max 2 Mo)' };

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { error: 'CSV vide ou sans données' };

    const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const nameIdx = header.findIndex((h) =>
      ['name', 'full_name', 'fullname', 'client', 'full name'].includes(h)
    );
    const phoneIdx = header.findIndex((h) =>
      ['phone', 'telephone', 'téléphone', 'whatsapp', 'mobile', 'tel'].includes(h)
    );
    const sourceIdx = header.findIndex((h) =>
      ['source', 'acquisition_source', 'origine'].includes(h)
    );
    const optInIdx = header.findIndex((h) =>
      ['opt_in', 'opt_in_whatsapp', 'whatsapp_opt_in', 'consentement'].includes(h)
    );

    if (nameIdx < 0 || phoneIdx < 0) {
      return {
        error:
          'Colonnes requises introuvables. Attendu : name/nom + phone/telephone (optionnel : source, opt_in).',
      };
    }

    const supabase = await createClient();
    const country = (await getOrganization(supabase, ctx.organizationId))?.country_code ?? null;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length && i <= 500; i++) {
      const cols = splitCsvLine(lines[i]!);
      const fullName = (cols[nameIdx] ?? '').trim();
      const phone = (cols[phoneIdx] ?? '').trim();
      if (!fullName || !phone) {
        skipped += 1;
        continue;
      }

      const acquisitionSource = sourceIdx >= 0 ? (cols[sourceIdx] ?? '').trim() : 'csv_import';
      const optInWhatsapp = csvOptIn(optInIdx >= 0 ? cols[optInIdx] : undefined);

      const e164 = normalizePhoneE164(phone, country);
      if (!e164) {
        errors.push(`Ligne ${i + 1}: numéro « ${phone} » non reconnu`);
        skipped += 1;
        continue;
      }
      if (await findClientIdByPhone(supabase, ctx.organizationId, e164)) {
        skipped += 1;
        continue;
      }

      const parsed = createClientSchema.safeParse({
        fullName,
        phone: e164,
        optInWhatsapp,
        whatsappConsentSource: 'import',
        acquisitionSource: acquisitionSource || 'csv_import',
      });
      if (!parsed.success) {
        errors.push(`Ligne ${i + 1}: ${parsed.error.errors[0]?.message}`);
        skipped += 1;
        continue;
      }

      try {
        await createCrmClient(supabase, ctx.organizationId, parsed.data);
        created += 1;
      } catch (e) {
        errors.push(`Ligne ${i + 1}: ${e instanceof Error ? e.message : 'erreur'}`);
        skipped += 1;
      }
    }

    revalidatePath('/clients');
    revalidatePath('/clients/collecter');
    return {
      success: `${created} client(s) importé(s), ${skipped} ignoré(s)`,
      created,
      skipped,
      errors: errors.slice(0, 10),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur import' };
  }
}

export async function importClientsCsvMappedAction(input: {
  csvText: string;
  mapping: Array<'ignore' | 'fullName' | 'phone' | 'source' | 'optIn'>;
}): Promise<CsvImportState> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const lines = input.csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { error: 'CSV vide ou sans données' };

    const nameIdx = input.mapping.indexOf('fullName');
    const phoneIdx = input.mapping.indexOf('phone');
    const sourceIdx = input.mapping.indexOf('source');
    const optInIdx = input.mapping.indexOf('optIn');
    if (nameIdx < 0 || phoneIdx < 0) {
      return { error: 'Mappez au moins les colonnes Nom et Téléphone' };
    }

    const supabase = await createClient();
    const country = (await getOrganization(supabase, ctx.organizationId))?.country_code ?? null;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length && i <= 500; i++) {
      const cols = splitCsvLine(lines[i]!);
      const fullName = (cols[nameIdx] ?? '').trim();
      const phone = (cols[phoneIdx] ?? '').trim();
      if (!fullName || !phone) {
        skipped += 1;
        continue;
      }

      const acquisitionSource = sourceIdx >= 0 ? (cols[sourceIdx] ?? '').trim() : 'csv_import';
      const optInWhatsapp = csvOptIn(optInIdx >= 0 ? cols[optInIdx] : undefined);

      const e164 = normalizePhoneE164(phone, country);
      if (!e164) {
        errors.push(`Ligne ${i + 1}: numéro « ${phone} » non reconnu`);
        skipped += 1;
        continue;
      }
      if (await findClientIdByPhone(supabase, ctx.organizationId, e164)) {
        skipped += 1;
        continue;
      }

      const parsed = createClientSchema.safeParse({
        fullName,
        phone: e164,
        optInWhatsapp,
        whatsappConsentSource: 'import',
        acquisitionSource: acquisitionSource || 'csv_import',
      });
      if (!parsed.success) {
        errors.push(`Ligne ${i + 1}: ${parsed.error.errors[0]?.message}`);
        skipped += 1;
        continue;
      }

      try {
        await createCrmClient(supabase, ctx.organizationId, parsed.data);
        created += 1;
      } catch (e) {
        errors.push(`Ligne ${i + 1}: ${e instanceof Error ? e.message : 'erreur'}`);
        skipped += 1;
      }
    }

    revalidatePath('/clients');
    revalidatePath('/clients/collecter');
    return {
      success: `${created} client(s) importé(s), ${skipped} ignoré(s)`,
      created,
      skipped,
      errors: errors.slice(0, 10),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur import' };
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export async function getOrgWhatsAppCollectContextAction(): Promise<{
  phone: string;
  restaurantName: string;
  phoneNumberId: string;
}> {
  const ctx = await requireAuthPermission('clients:read');
  const supabase = await createClient();
  const org = await getOrganization(supabase, ctx.organizationId);
  const settings = org?.settings ?? {};
  return {
    phone: String(settings.whatsapp_phone ?? ''),
    restaurantName: org?.name ?? 'Restaurant',
    phoneNumberId: String(settings.whatsapp_phone_number_id ?? ''),
  };
}
