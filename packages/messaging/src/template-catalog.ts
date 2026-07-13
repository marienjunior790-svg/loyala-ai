import type { MessageIntent, TemplateCatalogEntry } from './types';

const BASE_SPECS = [
  { slot: 1, maxLength: 60, role: 'first_name' as const },
  { slot: 2, maxLength: 200, role: 'body_core' as const },
  { slot: 3, maxLength: 60, role: 'restaurant_name' as const },
];

function entry(
  id: string,
  intent: MessageIntent,
  providerTemplateName: string,
  bodyPattern: string
): TemplateCatalogEntry {
  return {
    id,
    channel: 'whatsapp',
    intent,
    providerTemplateName,
    language: 'fr',
    bodyPattern,
    variableCount: 3,
    variableSpecs: BASE_SPECS,
    category: 'marketing',
    status: 'approved',
  };
}

/** Catalogue plateforme Loyala — templates Meta pré-approuvés (noms cibles). */
export const PLATFORM_TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  entry(
    'loyala_birthday_v1',
    'birthday',
    'loyala_birthday_v1',
    'Bonjour {{1}}, {{2}} 🎉 — {{3}}'
  ),
  entry(
    'loyala_inactive_v1',
    'inactive',
    'loyala_inactive_v1',
    'Bonjour {{1}}. {{2}} À bientôt chez {{3}}'
  ),
  entry(
    'loyala_loyalty_v1',
    'loyalty',
    'loyala_loyalty_v1',
    'Bonjour {{1}}, {{2}} — {{3}}'
  ),
  entry(
    'loyala_promo_v1',
    'promo',
    'loyala_promo_v1',
    '{{1}} : {{2}}. {{3}}'
  ),
];

export interface TemplateCatalogEnv {
  templateName?: string;
  templateLanguage?: string;
}

/**
 * Applique les overrides env (pilote Meta) tout en conservant le mapping variables par intent.
 */
export function resolveTemplateCatalog(
  env: TemplateCatalogEnv & { entries?: TemplateCatalogEntry[] } = {}
): TemplateCatalogEntry[] {
  const base = env.entries ?? PLATFORM_TEMPLATE_CATALOG;
  const overrideName = env.templateName?.trim();
  const overrideLang = env.templateLanguage?.trim();
  const pilotTemplate = overrideName === 'hello_world';

  return base.map((item) => ({
    ...item,
    providerTemplateName: overrideName || item.providerTemplateName,
    language: overrideLang || item.language,
    ...(pilotTemplate
      ? { variableCount: 0, variableSpecs: [] as TemplateCatalogEntry['variableSpecs'] }
      : {}),
  }));
}

export function findTemplateForIntent(
  catalog: TemplateCatalogEntry[],
  intent: MessageIntent
): TemplateCatalogEntry | undefined {
  return catalog.find((t) => t.intent === intent && t.status === 'approved');
}
