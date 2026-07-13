import type { MessageIntent, TemplateCatalogEntry, TemplateVariableSpec } from './types';

/** DB row shape (domain-crm) without package coupling. */
export interface DbTemplateCatalogRow {
  id: string;
  intent: MessageIntent;
  provider_template_name: string;
  language: string;
  body_pattern: string;
  variable_count: number;
  variable_specs: TemplateVariableSpec[];
  category: 'marketing' | 'utility';
  status: TemplateCatalogEntry['status'];
}

export function templateEntriesFromDbRows(rows: DbTemplateCatalogRow[]): TemplateCatalogEntry[] {
  return rows.map((row) => ({
    id: row.id,
    channel: 'whatsapp',
    intent: row.intent,
    providerTemplateName: row.provider_template_name,
    language: row.language,
    bodyPattern: row.body_pattern,
    variableCount: row.variable_count,
    variableSpecs: row.variable_specs,
    category: row.category,
    status: row.status,
  }));
}
