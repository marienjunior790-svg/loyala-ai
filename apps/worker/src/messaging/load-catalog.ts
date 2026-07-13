import { listApprovedWhatsAppTemplateRows } from '@loyala/domain-crm';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveTemplateCatalog,
  templateEntriesFromDbRows,
  type TemplateCatalogEnv,
} from '@loyala/messaging';

export interface LoadTemplateCatalogOptions extends TemplateCatalogEnv {
  organizationId?: string;
  fallbackToPlatform?: boolean;
}

export async function loadTemplateCatalog(
  supabase: SupabaseClient,
  options: LoadTemplateCatalogOptions = {}
): Promise<ReturnType<typeof resolveTemplateCatalog>> {
  const { organizationId, fallbackToPlatform = true, ...env } = options;

  try {
    const rows = await listApprovedWhatsAppTemplateRows(supabase, organizationId);
    if (rows.length > 0) {
      return resolveTemplateCatalog({
        ...env,
        entries: templateEntriesFromDbRows(rows),
      });
    }
  } catch {
    // Pre-migration-024.
  }

  if (!fallbackToPlatform) {
    return resolveTemplateCatalog({ ...env, entries: [] });
  }

  return resolveTemplateCatalog(env);
}
